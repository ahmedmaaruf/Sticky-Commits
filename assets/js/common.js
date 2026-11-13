// Small helpers shared across the site.
export const config = window.STICKER_WALL ?? {};
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
  },
};

export function hashNum(str, mod) {
  let h = 2166136261;
  for (const ch of String(str)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return Math.abs(h) % mod;
}

/** "owner/repo" from config, or guessed from a *.github.io address. */
export function repoSlug() {
  if (config.repo) return config.repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$|\/$/g, '');
  const m = location.hostname.match(/^([\w-]+)\.github\.io$/i);
  if (!m) return '';
  const first = location.pathname.split('/').filter(Boolean)[0];
  return first && !first.includes('.') ? `${m[1]}/${first}` : `${m[1]}/${m[1]}.github.io`;
}

export function applySiteText() {
  const title = config.title || 'Sticky Commits';
  const repo = repoSlug();
  for (const el of $$('[data-site-title]')) if (el.id !== 'title') el.textContent = title;
  for (const el of $$('[data-tagline]')) el.textContent = config.tagline || el.textContent;
  for (const el of $$('[data-class-name]')) el.textContent = config.className || el.textContent;
  for (const el of $$('[data-repo-link]')) {
    if (repo) el.href = `https://github.com/${repo}`;
    else el.removeAttribute('href');
  }
  for (const el of $$('[data-repo-name]')) el.textContent = repo ? repo.split('/')[1] : 'REPO';
  for (const el of $$('[data-repo-file]')) {
    el.href = repo ? `https://github.com/${repo}/blob/${config.branch || 'main'}/${el.dataset.repoFile}` : el.dataset.repoFile;
  }
  return { title, repo };
}

// ── theme ──
const root = document.documentElement;
const prefersDark = matchMedia('(prefers-color-scheme: dark)');
export const currentTheme = () => root.dataset.theme || (prefersDark.matches ? 'dark' : 'light');

export function initTheme(button) {
  const paint = () => { if (button) button.textContent = currentTheme() === 'dark' ? '☀️' : '🌙'; };
  paint();
  prefersDark.addEventListener?.('change', paint);
  button?.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    store.set('sw:theme', next);
    paint();
  });
}

// ── sticky header: frosted glass once the page is scrolled ──
export function initStickyHeader(bar) {
  if (!bar) return;
  let raf = 0;
  const paint = () => { raf = 0; bar.classList.toggle('scrolled', scrollY > 8); };
  addEventListener('scroll', () => { raf ||= requestAnimationFrame(paint); }, { passive: true });
  paint();
}

// ── toast ──
let toastTimer;
export function toast(message, ms = 2600) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ── floating toys follow the mouse a little ──
export function initParallax(el) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let raf = 0;
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      el.style.setProperty('--px', (e.clientX / innerWidth - 0.5).toFixed(3));
      el.style.setProperty('--py', (e.clientY / innerHeight - 0.5).toFixed(3));
    });
  });
}

const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
/** Split a title into bouncy sticker letters. */
const DEFAULT_TITLE_GRADIENT = ['#5b4bff', '#a04dff', '#ff5fa2'];

function hexToRgb(hex) {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return /^[0-9a-f]{6}$/i.test(h) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : null;
}

/** Colour at position t (0…1) along a list of hex stops. */
function gradientAt(stops, t) {
  const rgb = stops.map(hexToRgb).filter(Boolean);
  if (!rgb.length) return '#5b4bff';
  if (rgb.length === 1) return `rgb(${rgb[0].join(' ')})`;
  const x = Math.min(0.9999, Math.max(0, t)) * (rgb.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const mix = rgb[i].map((v, k) => Math.round(v + (rgb[i + 1][k] - v) * f));
  return `rgb(${mix.join(' ')})`;
}

/** Split a title into bouncy, glossy sticker letters that follow one gradient. */
export function puffTitle(el, text) {
  const stops = Array.isArray(config.titleGradient) && config.titleGradient.length
    ? config.titleGradient : DEFAULT_TITLE_GRADIENT;
  el.setAttribute('aria-label', text);
  el.textContent = '';
  const rtl = RTL_RE.test(text);
  // Arabic letters must stay joined, so RTL titles bounce word-by-word.
  const words = text.split(/\s+/).filter(Boolean).map((w) => (rtl ? [w] : [...w]));
  const total = Math.max(1, words.flat().length - 1);
  let i = 0;
  for (const parts of words) {
    const w = document.createElement('span');
    w.className = 'word';
    w.setAttribute('aria-hidden', 'true');
    for (const part of parts) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = part;
      s.dataset.ch = part;
      s.style.setProperty('--c', gradientAt(stops, i / total));
      s.style.setProperty('--r', `${((i * 37) % 11) - 5}deg`);
      s.style.setProperty('--i', i);
      w.append(s);
      i++;
    }
    el.append(w);
  }
}
