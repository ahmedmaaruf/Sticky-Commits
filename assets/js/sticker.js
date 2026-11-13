// ═══════════════════════════════════════════════════════════════
//  <sticker-card> — a 3D, tiltable, flippable sticker.
//
//  const el = document.createElement('sticker-card');
//  el.data = { name: 'Ahmed', shape: 'badge', finish: 'holo', ... };
//
//  Each sticker renders into its own shadow DOM, so a student's
//  custom CSS can only ever style their own sticker.
// ═══════════════════════════════════════════════════════════════
import {
  SHAPES, FINISHES, PATTERNS, ATTACH, IMAGE_FITS, DEFAULTS, LIMITS, isCssValueSafe,
} from './schema.js';
import { fontStack, ensureFont } from './fonts.js';

const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const instances = new Set();
let baseSheet = null;
let uid = 0;

/** Resolves once the sticker stylesheet is ready (await it before first paint). */
export const stickerReady = fetch(new URL('../css/sticker.css', import.meta.url))
  .then((r) => r.text())
  .then((css) => {
    baseSheet = new CSSStyleSheet();
    baseSheet.replaceSync(css);
    instances.forEach((el) => el.adoptStyles());
  });

// ── helpers ────────────────────────────────────────────────────
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}
function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
}

function luminance(color) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((color || '').trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Pick dark or white text for a given background colour. */
export function readableOn(bg, fallback = '#2b1d3f') {
  const L = luminance(bg);
  if (L == null) return fallback;
  return L > 0.4 ? '#2b1d3f' : '#ffffff';
}

function hashNum(str, mod) {
  let h = 2166136261;
  for (const ch of String(str)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return Math.abs(h) % mod;
}

/** Turn raw card.json data into a safe, complete card. */
export function normalizeCard(raw = {}) {
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const oneOf = (v, list, d) => ((Array.isArray(list) ? list : Object.keys(list)).includes(v) ? v : d);
  const color = (v, d) => (isCssValueSafe(v) && v.trim() ? v.trim() : d);
  const c = raw.colors && typeof raw.colors === 'object' ? raw.colors : {};

  const github = str(raw.github, 39).replace(/^@/, '');
  let image = raw.image === false ? '' : str(raw.image, 4000);
  const noImage = image === 'none' || raw.image === false;
  if (noImage || /^\s*javascript:/i.test(image)) image = '';
  if (!image && !noImage && github) image = `https://github.com/${encodeURIComponent(github)}.png?size=400`;

  const tilt = Number(raw.tilt);
  const colors = {
    background: color(c.background, DEFAULTS.colors.background),
    text: color(c.text, DEFAULTS.colors.text),
    accent: color(c.accent, DEFAULTS.colors.accent),
  };
  colors.name = color(c.name, colors.text);

  return {
    id: str(raw.id, 60) || github.toLowerCase() || 'sticker',
    demo: !!raw.demo,
    name: str(raw.name, LIMITS.name) || 'Mystery Sticker',
    title: str(raw.title, LIMITS.title),
    github,
    image,
    imageFit: oneOf(raw.imageFit, IMAGE_FITS, DEFAULTS.imageFit),
    imagePosition: isCssValueSafe(raw.imagePosition) ? raw.imagePosition : 'center',
    emoji: str(raw.emoji, LIMITS.emoji) || DEFAULTS.emoji,
    shape: oneOf(raw.shape, SHAPES, DEFAULTS.shape),
    finish: oneOf(raw.finish, FINISHES, DEFAULTS.finish),
    pattern: oneOf(raw.pattern, PATTERNS, DEFAULTS.pattern),
    font: str(raw.font, 40) || DEFAULTS.font,
    attach: oneOf(raw.attach, ATTACH, DEFAULTS.attach),
    tilt: Number.isFinite(tilt) ? Math.max(-LIMITS.tilt, Math.min(LIMITS.tilt, tilt)) : null,
    colors,
    about: str(raw.about, LIMITS.about),
    facts: (Array.isArray(raw.facts) ? raw.facts : [])
      .map((f) => str(f, LIMITS.fact)).filter(Boolean).slice(0, LIMITS.facts),
    css: typeof raw.css === 'string' ? raw.css : '',
    added: str(raw.added, 40),
  };
}

// ── the element ────────────────────────────────────────────────
export class StickerCard extends HTMLElement {
  #root;
  #data = null;
  #custom = new CSSStyleSheet();
  #raf = 0;
  #pt = [0.5, 0.5];

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.adoptStyles();
  }

  get data() { return this.#data; }
  set data(raw) {
    this.#data = normalizeCard(raw);
    this.render();
  }

  adoptStyles() {
    this.#root.adoptedStyleSheets = baseSheet ? [baseSheet, this.#custom] : [this.#custom];
  }

  connectedCallback() {
    instances.add(this);
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this.addEventListener('pointermove', this.#onMove);
    this.addEventListener('pointerleave', this.#onLeave);
    this.addEventListener('click', this.#onClick);
    this.addEventListener('keydown', this.#onKey);
    document.fonts?.addEventListener?.('loadingdone', this.#fit);
    requestAnimationFrame(this.#fit);
  }
  disconnectedCallback() {
    instances.delete(this);
    this.removeEventListener('pointermove', this.#onMove);
    this.removeEventListener('pointerleave', this.#onLeave);
    this.removeEventListener('click', this.#onClick);
    this.removeEventListener('keydown', this.#onKey);
    document.fonts?.removeEventListener?.('loadingdone', this.#fit);
  }

  flip(force) {
    const on = this.toggleAttribute('flipped', force);
    this.#syncFaces();
    this.dispatchEvent(new CustomEvent('sticker-flip', { bubbles: true, composed: true, detail: { flipped: on } }));
    return on;
  }

  // ── interaction ────────────────────────────────────────────
  #onMove = (e) => {
    if (e.pointerType === 'touch') return;
    const r = this.getBoundingClientRect();
    this.#pt = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    if (!this.hasAttribute('data-hover')) this.setAttribute('data-hover', '');
    this.#raf ||= requestAnimationFrame(() => {
      this.#raf = 0;
      const [x, y] = this.#pt;
      const s = this.style;
      s.setProperty('--rx', `${((0.5 - y) * 22).toFixed(2)}deg`);
      s.setProperty('--ry', `${((x - 0.5) * 26).toFixed(2)}deg`);
      s.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      s.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    });
  };

  #onLeave = () => {
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    this.removeAttribute('data-hover');
    for (const p of ['--rx', '--ry', '--mx', '--my']) this.style.removeProperty(p);
  };

  #onClick = (e) => {
    const interactive = e.composedPath().some((n) => n !== this && n instanceof Element && n.matches('a, button, input, [data-noflip]'));
    if (!interactive && !this.hasAttribute('noflip')) this.flip();
  };

  #onKey = (e) => {
    if (e.target !== this || this.hasAttribute('noflip')) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.flip(); }
  };

  #syncFaces() {
    const flipped = this.hasAttribute('flipped');
    this.#root.querySelector('.front')?.toggleAttribute('inert', flipped);
    this.#root.querySelector('.back')?.toggleAttribute('inert', !flipped);
  }

  /** Shrink long names until they fit on one line. */
  #fit = () => {
    for (const el of this.#root.querySelectorAll('[data-fit]')) {
      const base = parseFloat(el.dataset.fit);
      el.style.fontSize = `${base}em`;
      let k = 1;
      for (let i = 0; i < 14 && el.scrollWidth > el.clientWidth + 1 && k > 0.5; i++) {
        k *= 0.92;
        el.style.fontSize = `${(base * k).toFixed(3)}em`;
      }
    }
    for (const text of this.#root.querySelectorAll('text[data-arc]')) {
      const max = parseFloat(text.dataset.arc);
      let size = parseFloat(text.getAttribute('font-size'));
      for (let i = 0; i < 12 && text.getComputedTextLength() > max && size > 9; i++) {
        size *= 0.92;
        text.setAttribute('font-size', size.toFixed(2));
      }
    }
  };

  // ── rendering ──────────────────────────────────────────────
  render() {
    const d = this.#data;
    if (!d) return;
    ensureFont(d.font);

    const vars = {
      '--bg': d.colors.background,
      '--ink': d.colors.text,
      '--accent': d.colors.accent,
      '--name-color': d.colors.name,
      '--label-ink': readableOn(d.colors.accent),
      '--on-paper': (luminance(d.colors.text) ?? 0) > 0.45 ? '#2b1d3f' : d.colors.text,
      '--font': fontStack(d.font),
      '--fit': d.imageFit,
      '--focus': d.imagePosition,
      '--img': d.image ? `url(${JSON.stringify(d.image)})` : 'none',
      '--tape-rot': `${hashNum(d.id, 9) - 4}deg`,
    };
    for (const [k, v] of Object.entries(vars)) this.style.setProperty(k, v);

    this.setAttribute('role', 'group');
    this.setAttribute('aria-roledescription', 'sticker');
    this.setAttribute('aria-label', `${d.name}${d.title ? ` — ${d.title}` : ''}. Press Enter to flip.`);

    try { this.#custom.replaceSync(d.css || ''); } catch { /* ignore broken custom CSS */ }

    const rtl = RTL_RE.test(d.name);
    const front = h('div', { class: `face front s-${d.shape} f-${d.finish}` },
      h('div', { class: 'wrap' },
        this.#shape(d, rtl),
        h('div', { class: 'peel', part: 'peel' })),
      d.attach !== 'none' && h('div', { class: `attach ${d.attach}`, part: d.attach }));

    const back = h('div', { class: 'face back', inert: true }, h('div', { class: 'wrap' }, this.#back(d)));

    this.#root.replaceChildren(
      h('div', { class: 'scene' }, h('div', { class: 'tilt' }, h('div', { class: 'flipper' }, front, back))));
    this.#syncFaces();
    requestAnimationFrame(this.#fit);
  }

  #picture(d, cls = 'photo') {
    const fallback = () => h('div', { class: 'big-emoji', text: d.emoji });
    const kids = [];
    if (d.image) {
      const img = h('img', {
        src: d.image, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false',
        onerror: () => img.replaceWith(fallback()),
      });
      kids.push(img);
    } else kids.push(fallback());
    return cls ? h('div', { class: cls, part: 'photo' }, kids) : kids[0];
  }

  #fx() {
    return [h('div', { class: 'fx foil' }), h('div', { class: 'fx glare' })];
  }

  #emoji(d) {
    return d.image ? h('div', { class: 'emoji-bubble', part: 'emoji' }, h('span', { text: d.emoji })) : null;
  }

  #name(d, rtl, base = 1.55) {
    // Arabic/Hebrew script reads small at the same size, so give it a boost.
    return h('h3', { class: 'name', part: 'name', dir: rtl ? 'rtl' : 'auto', 'data-fit': rtl ? base * 1.3 : base, text: d.name });
  }

  #title(d) {
    return d.title ? h('p', { class: 'title', part: 'title', dir: 'auto', text: d.title }) : null;
  }

  #shape(d, rtl) {
    const pat = `pat-${d.pattern}`;
    switch (d.shape) {
      case 'polaroid':
        return h('div', { class: `sticker ${pat}`, part: 'sticker' },
          this.#picture(d), this.#emoji(d), this.#name(d, rtl, 1.7), this.#title(d), this.#fx());

      case 'badge': {
        const id = `arc${++uid}`;
        const n = [...d.name].length;
        const nameSize = Math.max(11, Math.min(21, 360 / Math.max(n, 1)));
        const sub = (d.title || '').toUpperCase();
        const subSize = Math.max(8, Math.min(12, 300 / Math.max([...sub].length, 1)));
        const ring = svg('svg', { viewBox: '0 0 200 200', 'aria-hidden': 'true' },
          svg('defs', {},
            svg('path', { id: `${id}t`, d: 'M 100,100 m -77,0 a 77,77 0 1,1 154,0' }),
            svg('path', { id: `${id}b`, d: 'M 100,100 m -90,0 a 90,90 0 0,0 180,0' })),
          !rtl && svg('text', { 'font-size': nameSize.toFixed(1), 'text-anchor': 'middle', 'data-arc': 210 },
            svg('textPath', { href: `#${id}t`, startOffset: '50%' }, d.name)),
          sub && svg('text', { class: 'ring-sub', 'font-size': subSize.toFixed(1), 'text-anchor': 'middle', 'data-arc': 220 },
            svg('textPath', { href: `#${id}b`, startOffset: '50%' }, sub)),
          svg('text', { x: 13, y: 105, 'font-size': 12, 'text-anchor': 'middle' }, '★'),
          svg('text', { x: 187, y: 105, 'font-size': 12, 'text-anchor': 'middle' }, '★'));
        return [
          h('div', { class: 'sticker', part: 'sticker' },
            h('div', { class: `ring ${pat}` }, this.#picture(d), ring),
            this.#fx()),
          this.#emoji(d),
          rtl && h('p', { class: 'badge-caption', dir: 'rtl', part: 'name', text: d.name }),
        ];
      }

      case 'ticket':
        return h('div', { class: 'sticker', part: 'sticker' },
          h('div', { class: `surface ${pat}` },
            this.#picture(d), this.#emoji(d),
            h('div', { class: 'perf' }),
            this.#name(d, rtl, 1.5), this.#title(d),
            h('div', { class: 'stub' },
              h('span', { text: `№ ${String(hashNum(d.id, 999) + 1).padStart(3, '0')} · admit one` }),
              h('span', { class: 'barcode' }))),
          this.#fx());

      case 'blob':
        return [
          h('div', { class: 'sticker', part: 'sticker' },
            h('div', { class: `surface ${pat}` }, this.#picture(d)),
            this.#fx()),
          this.#emoji(d),
          h('p', { class: 'label', part: 'name', dir: rtl ? 'rtl' : 'auto', 'data-fit': 1.3, text: d.name }),
          d.title && h('p', { class: 'sub', part: 'title', dir: 'auto', text: d.title }),
        ];

      case 'cutout':
        return [
          h('div', { class: 'sticker', part: 'sticker' },
            h('div', { class: 'art', part: 'photo' }, this.#picture(d, null)),
            d.image && this.#fx()),
          h('p', { class: 'label', part: 'name', dir: rtl ? 'rtl' : 'auto', 'data-fit': 1.3, text: d.name }),
          d.title && h('p', { class: 'sub', part: 'title', dir: 'auto', text: d.title }),
        ];

      default: // classic
        return h('div', { class: 'sticker', part: 'sticker' },
          h('div', { class: `surface ${pat}` },
            this.#picture(d), this.#emoji(d), this.#name(d, rtl), this.#title(d)),
          this.#fx());
    }
  }

  #back(d) {
    const avatar = h('div', { class: 'avatar' },
      d.image ? h('img', { src: d.image, alt: '', loading: 'lazy' }) : h('span', { text: d.emoji }));
    const added = d.added ? new Date(d.added) : null;
    let when = 'fresh sticker ✨';
    if (d.demo) when = 'demo sticker 🧪';
    else if (added && !Number.isNaN(+added)) {
      when = `stuck on ${added.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    return h('div', { class: 'sticker', part: 'back' },
      h('div', { class: `surface pat-${d.pattern}` },
        h('div', { class: 'card-back' },
          h('span', { class: 'flip-hint', 'aria-hidden': 'true', text: '↺' }),
          h('div', { class: 'who' }, avatar,
            h('div', { class: 'who-text' },
              h('p', { class: 'back-name', dir: 'auto', text: d.name }),
              d.github
                ? h('a', { class: 'handle', href: `https://github.com/${encodeURIComponent(d.github)}`, target: '_blank', rel: 'noopener', text: `@${d.github} ↗` })
                : h('span', { class: 'handle', text: d.title || '' }))),
          h('p', { class: `about${d.about ? '' : ' empty'}`, dir: 'auto', text: d.about || 'This sticker is a little mysterious… 👀' }),
          d.facts.length > 0 && h('ul', { class: 'facts' }, d.facts.map((f) => h('li', { dir: 'auto', text: f }))),
          h('div', { class: 'back-foot' },
            h('span', { text: when }),
            h('button', {
              class: 'share', type: 'button', text: '🔗 Share',
              onclick: () => this.dispatchEvent(new CustomEvent('sticker-share', { bubbles: true, composed: true, detail: { id: d.id } })),
            })))));
  }
}

if (!customElements.get('sticker-card')) customElements.define('sticker-card', StickerCard);
