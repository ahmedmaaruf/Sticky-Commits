#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  Builds cards.json from every cards/<username>/card.json
//  and checks that each sticker follows the rules.
//
//    node scripts/build.mjs                 → writes ./cards.json
//    node scripts/build.mjs --out _site     → full site in _site/ (what Vercel deploys)
//    node scripts/build.mjs --check         → validate only (used on pull requests)
//         [--author <github-login>] [--base <git-sha>]
//    node scripts/build.mjs --sync          → tell Supabase which stickers exist
//         (needs the STICKER_SYNC_KEY environment variable; used by a GitHub Action)
//
//  No dependencies — just Node 18+.
// ═══════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  SHAPES, FINISHES, PATTERNS, ATTACH, IMAGE_FITS, IMAGE_EXTS, LIMITS, USERNAME_RE,
  KNOWN_KEYS, COLOR_KEYS, FONTS, CUSTOM_FONT_RE, isCssValueSafe,
} from '../assets/js/schema.js';
import { supabase } from '../assets/js/supabase.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = [
  { dir: 'cards', demo: false },
  { dir: 'demo-cards', demo: true },
];
const SITE_FILES = ['index.html', 'wall.html', 'moderate.html', 'config.js', 'assets', 'cards', 'demo-cards'];

// ── tiny helpers ───────────────────────────────────────────────
const isUrl = (s) => /^https:\/\//i.test(s);
const kb = (n) => `${Math.round(n / 1024)} KB`;

function closest(word, options) {
  const dist = (a, b) => {
    const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return m[a.length][b.length];
  };
  const w = String(word).toLowerCase();
  const best = options.map((o) => [o, dist(w, o.toLowerCase())]).sort((a, b) => a[1] - b[1])[0];
  return best && best[1] <= Math.max(2, Math.floor(w.length / 3)) ? best[0] : null;
}
const didYouMean = (v, list) => {
  const guess = closest(v, list);
  return guess ? ` Did you mean "${guess}"?` : ` Pick one of: ${list.join(', ')}.`;
};

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}
const inGitRepo = () => git('rev-parse', '--is-inside-work-tree') === 'true';

function jsonErrorHint(text, err) {
  const hints = [];
  if (/[“”]/.test(text)) hints.push('it contains curly quotes “ ” — use plain straight quotes "');
  if (/,\s*[}\]]/.test(text)) hints.push('there is a trailing comma before a } or ]');
  if (/'[^']*'\s*:/.test(text)) hints.push("keys must use double quotes, not single quotes");
  const pos = Number(/position (\d+)/.exec(err.message)?.[1]);
  let where = '';
  if (Number.isFinite(pos)) {
    const before = text.slice(0, pos).split('\n');
    where = ` (line ${before.length}, column ${before.at(-1).length + 1})`;
  } else {
    const lc = /line (\d+) column (\d+)/.exec(err.message);
    if (lc) where = ` (line ${lc[1]}, column ${lc[2]})`;
  }
  return `card.json is not valid JSON${where}.${hints.length ? ` Hint: ${hints.join('; ')}.` : ''}`;
}

// ── custom CSS: pictures only from the sticker's own folder ────
// Loading files from other websites would let someone track everybody who
// opens the wall, so sticker CSS may only use files from its own folder
// (or data: URIs). Relative url()s are rewritten to point at that folder.
const CSS_URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi;
const CSS_FILE_EXTS = [...IMAGE_EXTS, '.woff', '.woff2', '.ttf', '.otf'];

/** Decode CSS escapes (\41 → "A", \/ → "/") so tricks can't hide a web address. */
const cssUnescape = (s) => s
  .replace(/\\([0-9a-f]{1,6})[ \t\n\r\f]?/gi, (_, hex) => {
    const n = parseInt(hex, 16);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '�';
  })
  .replace(/\\([^\n])/g, '$1');

function checkCss(css, rel, abs, err, warn) {
  const noComments = css.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, ' ');
  if (/@import/i.test(cssUnescape(noComments))) warn('@import is not supported in sticker CSS and will be ignored.');

  let bad = false;
  const out = noComments.replace(CSS_URL_RE, (whole, dq, sq, bare) => {
    // browsers ignore tabs and line breaks inside addresses, so we do too
    const value = cssUnescape(dq ?? sq ?? bare ?? '').replace(/[\t\n\r\f]/g, '').trim();
    if (/^data:/i.test(value)) return whole;
    const file = value.split(/[?#]/)[0];
    if (!file || /^[a-z][a-z0-9+.-]*:/i.test(file) || /^[/\\]/.test(file) || file.includes('..')) {
      bad = true;
      return whole;
    }
    const dir = path.join(abs, path.dirname(file));
    if (!fs.existsSync(dir) || !fs.readdirSync(dir).includes(path.basename(file))) {
      err(`Custom CSS uses "${file}", but it isn't in ${rel}/ (file names are case-sensitive).`);
    } else if (!CSS_FILE_EXTS.includes(path.extname(file).toLowerCase())) {
      err(`Custom CSS can only use pictures or fonts — "${file}" isn't one.`);
    }
    return `url("${rel}/${file.split('/').map(encodeURIComponent).join('/')}")`;
  });

  // Whatever is left must not reach another website — this also catches
  // image-set("…"), escaped characters and other sneaky spellings.
  const scan = cssUnescape(out.replace(CSS_URL_RE, (whole, dq, sq, bare) => (
    /^data:/i.test(cssUnescape(dq ?? sq ?? bare ?? '').trim()) ? 'url()' : whole)))
    .replace(/[\t\n\r\f]/g, '');
  if (bad || /\/\/|https?:/i.test(scan)) {
    err(`Custom CSS can't load files from other websites. Put the picture in ${rel}/ and use it like: url("my-picture.png").`);
  }
  return out;
}

// ── validate one sticker folder ────────────────────────────────
function readCard(sourceDir, folder, demo) {
  const rel = `${sourceDir}/${folder}`;
  const abs = path.join(ROOT, rel);
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  const result = { id: folder, folder: rel, file: `${rel}/card.json`, errors, warnings, card: null };

  if (!USERNAME_RE.test(folder)) {
    if (USERNAME_RE.test(folder.toLowerCase())) err(`Folder names must be lowercase: rename "${rel}" → "${sourceDir}/${folder.toLowerCase()}".`);
    else err(`"${folder}" isn't a valid GitHub username folder (letters, numbers and single hyphens only).`);
  }

  const jsonPath = path.join(abs, 'card.json');
  if (!fs.existsSync(jsonPath)) {
    const other = fs.readdirSync(abs).find((f) => /^card\.json/i.test(f) || f.toLowerCase() === 'card.json');
    err(other ? `Found "${other}" — the file must be named exactly "card.json".` : 'Missing card.json in this folder.');
    return result;
  }

  const text = fs.readFileSync(jsonPath, 'utf8').replace(/^﻿/, '');
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    err(jsonErrorHint(text, e));
    return result;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    err('card.json must contain one { ... } object.');
    return result;
  }

  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.includes(key)) warn(`Unknown field "${key}" will be ignored.${didYouMean(key, KNOWN_KEYS.filter((k) => k !== '$schema'))}`);
  }

  const text_ = (key, max, required = false) => {
    const v = raw[key];
    if (v == null || v === '') { if (required) err(`"${key}" is required.`); return undefined; }
    if (typeof v !== 'string') { err(`"${key}" must be text (in "quotes").`); return undefined; }
    if (v.trim().length > max) err(`"${key}" is ${v.trim().length} characters — the limit is ${max}.`);
    return v.trim().slice(0, max);
  };
  const enumOf = (key, list) => {
    const v = raw[key];
    if (v == null) return undefined;
    const options = Array.isArray(list) ? list : Object.keys(list);
    if (!options.includes(v)) { err(`"${key}": "${v}" isn't an option.${didYouMean(v, options)}`); return undefined; }
    return v;
  };

  // Demo ids get a prefix so a student whose username matches a demo folder
  // (e.g. "noor") never collides with it.
  const card = { id: demo ? `demo-${folder.toLowerCase()}` : folder.toLowerCase(), demo };
  card.name = text_('name', LIMITS.name, true);
  card.title = text_('title', LIMITS.title);
  card.about = text_('about', LIMITS.about);
  card.emoji = text_('emoji', LIMITS.emoji);
  card.shape = enumOf('shape', SHAPES);
  card.finish = enumOf('finish', FINISHES);
  card.pattern = enumOf('pattern', PATTERNS);
  card.attach = enumOf('attach', ATTACH);
  card.imageFit = enumOf('imageFit', IMAGE_FITS);

  if (raw.imagePosition != null) {
    if (isCssValueSafe(raw.imagePosition)) card.imagePosition = raw.imagePosition;
    else err('"imagePosition" should look like "center", "top" or "50% 20%".');
  }

  // github handle — defaults to the folder name for real stickers
  if (raw.github != null) {
    const gh = String(raw.github).replace(/^@/, '');
    if (!USERNAME_RE.test(gh.toLowerCase())) err(`"github": "${raw.github}" doesn't look like a GitHub username.`);
    else card.github = gh;
  } else if (!demo) {
    card.github = folder;
  }

  // font
  if (raw.font != null) {
    if (typeof raw.font !== 'string' || !CUSTOM_FONT_RE.test(raw.font)) {
      err(`"font": "${raw.font}" isn't a valid font name.`);
    } else {
      card.font = raw.font;
      if (!FONTS[raw.font]) {
        const guess = closest(raw.font, Object.keys(FONTS));
        warn(`Font "${raw.font}" isn't in the preset list — we'll try to load it from Google Fonts.${guess ? ` Did you mean "${guess}"?` : ''}`);
      }
    }
  }

  // colours
  if (raw.colors != null) {
    if (typeof raw.colors !== 'object' || Array.isArray(raw.colors)) err('"colors" must be an object like { "background": "#ffd6ec" }.');
    else {
      card.colors = {};
      for (const [k, v] of Object.entries(raw.colors)) {
        if (!COLOR_KEYS.includes(k)) { warn(`colors."${k}" will be ignored.${didYouMean(k, COLOR_KEYS)}`); continue; }
        if (!isCssValueSafe(v)) err(`colors.${k}: "${v}" isn't a usable colour (no ; { } < > allowed, max ${LIMITS.color} chars).`);
        else card.colors[k] = v.trim();
      }
    }
  }

  // tilt
  if (raw.tilt != null) {
    const t = Number(raw.tilt);
    if (!Number.isFinite(t)) err('"tilt" must be a number, like -4 or 6.');
    else {
      if (Math.abs(t) > LIMITS.tilt) warn(`"tilt" is clamped to ±${LIMITS.tilt} degrees.`);
      card.tilt = Math.max(-LIMITS.tilt, Math.min(LIMITS.tilt, t));
    }
  }

  // facts
  if (raw.facts != null) {
    if (!Array.isArray(raw.facts)) err('"facts" must be a list like ["fact one", "fact two"].');
    else {
      if (raw.facts.length > LIMITS.facts) warn(`Only the first ${LIMITS.facts} facts are shown.`);
      card.facts = raw.facts.slice(0, LIMITS.facts).filter((f, i) => {
        if (typeof f !== 'string') { err(`facts[${i}] must be text.`); return false; }
        if (f.length > LIMITS.fact) err(`facts[${i}] is ${f.length} characters — the limit is ${LIMITS.fact}.`);
        return true;
      }).map((f) => f.trim().slice(0, LIMITS.fact));
    }
  }

  // image
  if (raw.image === false || raw.image === 'none') {
    card.image = 'none';
  } else if (raw.image != null) {
    if (typeof raw.image !== 'string' || !raw.image.trim()) err('"image" must be a file name like "photo.png", a https:// link, or "none".');
    else if (isUrl(raw.image)) {
      card.image = raw.image.trim();
      warn('Linked images can disappear one day — adding the file to your folder is safer.');
    } else if (/^[a-z]+:/i.test(raw.image) || raw.image.includes('..') || raw.image.startsWith('/')) {
      err(`"image": "${raw.image}" — use a file inside your folder (like "photo.png") or a https:// link.`);
    } else {
      const imgAbs = path.join(abs, raw.image);
      const ext = path.extname(raw.image).toLowerCase();
      // Check the exact spelling: Mac/Windows ignore upper/lower case, but the live website doesn't.
      const exact = fs.existsSync(path.dirname(imgAbs)) && fs.readdirSync(path.dirname(imgAbs)).includes(path.basename(imgAbs));
      if (!IMAGE_EXTS.includes(ext)) err(`"${raw.image}" — images must be one of: ${IMAGE_EXTS.join(' ')}.`);
      else if (!exact) {
        const nearby = fs.existsSync(path.dirname(imgAbs))
          && fs.readdirSync(path.dirname(imgAbs)).find((f) => f.toLowerCase() === path.basename(imgAbs).toLowerCase());
        err(nearby
          ? `Image "${raw.image}" not found — but "${nearby}" exists. File names are case-sensitive!`
          : `Image "${raw.image}" not found in ${rel}/. Did you forget to commit it?`);
      } else {
        const size = fs.statSync(imgAbs).size;
        if (size > LIMITS.imageBytes) err(`"${raw.image}" is ${kb(size)} — please shrink it under ${kb(LIMITS.imageBytes)} (try squoosh.app).`);
        else if (size > LIMITS.imageWarnBytes) warn(`"${raw.image}" is ${kb(size)} — it'll load faster under ${kb(LIMITS.imageWarnBytes)}.`);
        card.image = `${rel}/${raw.image.split('/').map(encodeURIComponent).join('/')}`;
      }
    }
  }

  // custom css (inlined so the site needs one request for everything)
  if (raw.css != null) {
    const cssPath = typeof raw.css === 'string' ? path.join(abs, raw.css) : '';
    if (!cssPath || !raw.css.endsWith('.css') || raw.css.includes('..')) err('"css" must be a .css file in your folder, like "style.css".');
    else if (!fs.existsSync(cssPath)) err(`CSS file "${raw.css}" not found in ${rel}/.`);
    else {
      const css = fs.readFileSync(cssPath, 'utf8');
      if (css.length > LIMITS.cssBytes) err(`"${raw.css}" is ${kb(css.length)} — keep custom CSS under ${kb(LIMITS.cssBytes)}.`);
      card.css = checkCss(css, rel, abs, err, warn);
    }
  }

  // when was it first added? (git history; outside git, falls back to the file's time)
  let added = '';
  if (inGitRepoCached()) added = git('log', '--diff-filter=A', '--follow', '--format=%aI', '--', `${rel}/card.json`).split('\n').at(-1) || '';
  // In a partial (shallow) clone a missing date just means "older than the history we have" —
  // leave it empty rather than stamping today's date on it.
  if (!added && !isShallowClone) {
    const st = fs.statSync(jsonPath);
    added = (st.birthtimeMs ? st.birthtime : st.mtime).toISOString();
  }
  if (added) card.added = added;

  for (const k of Object.keys(card)) if (card[k] === undefined) delete card[k];
  result.card = card;
  return result;
}

let gitCache;
let isShallowClone = false;
const inGitRepoCached = () => {
  if (gitCache !== undefined) return gitCache;
  gitCache = inGitRepo();
  // Hosting services like Vercel clone only the latest few commits. Fetch the rest so
  // every sticker gets its real "added" date (NEW! badge, newest-in-the-middle order).
  if (gitCache && git('rev-parse', '--is-shallow-repository') === 'true') {
    git('fetch', '--unshallow', '--quiet');
    isShallowClone = git('rev-parse', '--is-shallow-repository') === 'true';
  }
  return gitCache;
};

// ── collect everything ─────────────────────────────────────────
export function collectCards() {
  const results = [];
  for (const { dir, demo } of SOURCES) {
    const base = path.join(ROOT, dir);
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      if (!entry.isDirectory()) {
        if (!demo && entry.name !== 'README.md') {
          results.push({ id: entry.name, folder: dir, file: `${dir}/${entry.name}`, card: null, warnings: [],
            errors: [`"${dir}/${entry.name}" should be inside a folder named after your GitHub username: ${dir}/<username>/card.json`] });
        }
        continue;
      }
      results.push(readCard(dir, entry.name, demo));
    }
  }
  return results;
}

export function buildManifest() {
  const results = collectCards();
  const cards = results.filter((r) => r.card && !r.errors.length).map((r) => r.card);
  return { manifest: { generatedAt: new Date().toISOString(), count: cards.length, cards }, results };
}

// ── PR ownership check ─────────────────────────────────────────
function changedFiles(base) {
  const out = git('diff', '--name-only', `${base}...HEAD`) || git('diff', '--name-only', base, 'HEAD');
  return out.split('\n').filter(Boolean);
}

// ── reporting ──────────────────────────────────────────────────
const inActions = !!process.env.GITHUB_ACTIONS;
function report(results, { strictIds = null } = {}) {
  let errorCount = 0;
  const lines = [];
  for (const r of results) {
    const strict = !strictIds || strictIds.has(r.folder);
    const errs = strict ? r.errors : [];
    const warns = strict ? r.warnings : [...r.warnings, ...r.errors];
    if (!errs.length && !warns.length) {
      if (strict && strictIds) lines.push(`✅ ${r.folder} looks great!`);
      continue;
    }
    lines.push(`${errs.length ? '❌' : '⚠️ '} ${r.folder}`);
    for (const e of errs) {
      lines.push(`   ✖ ${e}`);
      if (inActions) console.log(`::error file=${r.file},title=Sticker problem::${e}`);
    }
    for (const w of warns) {
      lines.push(`   ⚠ ${w}`);
      if (inActions && strict) console.log(`::warning file=${r.file},title=Sticker tip::${w}`);
    }
    errorCount += errs.length;
  }
  return { errorCount, text: lines.join('\n') };
}

function writeSummary(md) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
}

// ── tell the database which stickers exist (GitHub Action) ─────
/** Reads window.STICKER_WALL from config.js without a browser. */
function readSiteConfig() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8'), sandbox, { filename: 'config.js' });
  return sandbox.window.STICKER_WALL || {};
}

async function syncStickers() {
  const db = supabase(readSiteConfig());
  if (!db) {
    console.log('ℹ️  Supabase isn\'t set up in config.js yet — nothing to sync.');
    return;
  }
  const key = (process.env.STICKER_SYNC_KEY || '').trim();
  if (!key) {
    console.log('ℹ️  No STICKER_SYNC_KEY secret yet — skipping. (Add it under Settings → Secrets and variables → Actions.)');
    return;
  }
  const { manifest } = buildManifest();
  const ids = manifest.cards.map((c) => c.id);
  const total = await db.rpc('sync_stickers', { p_key: key, p_ids: ids });
  console.log(`🔄 Synced ${ids.length} sticker(s) — the database now knows ${total}.`);
  writeSummary(`## 🔄 Sticker list synced\n\n${ids.length} sticker(s) can now be liked and commented on.`);
}

// ── JSON Schema (editor autocomplete for card.json) ────────────
export function cardJsonSchema() {
  const str = (max, description) => ({ type: 'string', maxLength: max, description });
  const color = (description) => ({ type: 'string', maxLength: LIMITS.color, pattern: '^[^;{}<>\\\\]*$', description });
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Sticky Commits sticker',
    description: 'Your sticker for the class wall. Generated from assets/js/schema.js — run `npm run schema` after changing the rules.',
    type: 'object',
    required: ['name'],
    additionalProperties: false,
    properties: {
      $schema: { type: 'string' },
      name: { ...str(LIMITS.name, 'The big name on your sticker.'), minLength: 1 },
      title: str(LIMITS.title, 'A short tagline under your name.'),
      github: { type: 'string', description: 'Your GitHub username (defaults to your folder name).', pattern: '^@?[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$' },
      image: { type: 'string', description: 'A picture file in your folder (e.g. "photo.png"), a https:// link, or "none" for emoji-only. Leave it out to use your GitHub avatar.' },
      imageFit: { enum: IMAGE_FITS, description: '"cover" fills the frame, "contain" shows the whole picture.' },
      imagePosition: { type: 'string', description: 'Which part of the picture to focus on.', examples: ['center', 'top', 'bottom', '50% 20%'] },
      emoji: str(LIMITS.emoji, 'A little emoji badge (or your whole picture when image is "none").'),
      shape: { enum: Object.keys(SHAPES), description: Object.entries(SHAPES).map(([k, v]) => `${k}: ${v}`).join('\n') },
      finish: { enum: Object.keys(FINISHES), description: Object.entries(FINISHES).map(([k, v]) => `${k}: ${v}`).join('\n') },
      pattern: { enum: PATTERNS, description: 'A background pattern.' },
      font: {
        description: 'One of the preset fonts, or any Google Fonts name.',
        anyOf: [{ enum: Object.keys(FONTS) }, { type: 'string', pattern: CUSTOM_FONT_RE.source }],
      },
      colors: {
        type: 'object',
        additionalProperties: false,
        description: 'Any CSS colours — background can also be a gradient.',
        properties: {
          background: color('Background colour or gradient, e.g. "#ffd6ec" or "linear-gradient(160deg, #ffb17a, #ff6fae)".'),
          text: color('Text colour.'),
          accent: color('Accent colour: badge ring, labels, pin and tape.'),
          name: color('A different colour just for your name (optional).'),
        },
      },
      attach: { enum: ATTACH, description: 'How your sticker is stuck to the wall.' },
      tilt: { type: 'number', minimum: -LIMITS.tilt, maximum: LIMITS.tilt, description: 'Rotation in degrees. Leave it out for a random tilt.' },
      about: str(LIMITS.about, 'Text on the back of your sticker.'),
      facts: { type: 'array', maxItems: LIMITS.facts, items: str(LIMITS.fact, 'A fun fact.'), description: `Up to ${LIMITS.facts} fun facts for the back.` },
      css: { type: 'string', pattern: '^[^/]+\\.css$', description: 'Your own CSS file in your folder, e.g. "style.css".' },
    },
  };
}

// ── CLI ────────────────────────────────────────────────────────
function cli() {
  const args = process.argv.slice(2);
  const flag = (name) => args.includes(name);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

  if (flag('--sync')) {
    syncStickers().catch((e) => {
      console.error(`💥 Couldn't sync the sticker list: ${e.message}`);
      process.exit(1);
    });
    return;
  }

  if (flag('--schema')) {
    fs.writeFileSync(path.join(ROOT, 'card.schema.json'), `${JSON.stringify(cardJsonSchema(), null, 2)}\n`);
    console.log('📐 Wrote card.schema.json');
    return;
  }

  const { manifest, results } = buildManifest();

  if (flag('--check')) {
    const author = (opt('--author') || '').toLowerCase();
    const base = opt('--base');
    let strictIds = null;
    const ownership = [];
    if (base) {
      const changed = changedFiles(base);
      strictIds = new Set();
      for (const f of changed) {
        const m = /^cards\/([^/]+)(\/|$)/.exec(f);
        if (!m || m[1].startsWith('_')) continue;
        strictIds.add(`cards/${m[1]}`);
        if (author && m[1].toLowerCase() !== author) {
          ownership.push(`This PR changes "cards/${m[1]}/" but you're @${author}. You can only add or edit your own folder: cards/${author}/`);
        }
      }
      if (author && changed.some((f) => /^cards\/[^/]+$/.test(f) && !f.endsWith('README.md'))) {
        ownership.push(`Put your files inside cards/${author}/ — not loose in the cards/ folder.`);
      }
    }
    const { errorCount, text } = report(results, { strictIds });
    const unique = [...new Set(ownership)];
    for (const o of unique) if (inActions) console.log(`::error title=Wrong folder::${o}`);

    console.log(`\n🧩 Checked ${results.length} sticker folder(s)${strictIds ? `, ${strictIds.size} changed in this PR` : ''}.\n`);
    if (text) console.log(text);
    for (const o of unique) console.log(`❌ ${o}`);

    const failed = errorCount + unique.length > 0;
    writeSummary(failed
      ? `## ❌ Your sticker needs a small fix\n\n\`\`\`\n${[text, ...unique.map((o) => `❌ ${o}`)].filter(Boolean).join('\n')}\n\`\`\`\n\nFix the problems above, commit again, and this check will re-run automatically. 💪`
      : `## ✅ Sticker check passed!\n\n${text ? `\`\`\`\n${text}\n\`\`\`\n\n` : ''}Nice work — a maintainer can merge your pull request now. 🎉`);
    console.log(failed ? '\n💔 Some stickers need fixing (see above).' : '\n✨ All good — ready to merge!');
    process.exit(failed ? 1 : 0);
  }

  const { text } = report(results);
  if (text) console.log(`${text}\n(Stickers with ✖ errors are skipped until fixed.)\n`);

  const outDir = opt('--out');
  if (outDir) {
    const out = path.resolve(ROOT, outDir);
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    for (const f of SITE_FILES) {
      const src = path.join(ROOT, f);
      if (fs.existsSync(src)) fs.cpSync(src, path.join(out, f), { recursive: true });
    }
    fs.writeFileSync(path.join(out, 'cards.json'), JSON.stringify(manifest));
    console.log(`📦 Built site → ${path.relative(ROOT, out) || '.'}/ with ${manifest.count} stickers`);
  } else {
    fs.writeFileSync(path.join(ROOT, 'cards.json'), JSON.stringify(manifest, null, 2));
    console.log(`🧩 Wrote cards.json with ${manifest.count} stickers`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) cli();
