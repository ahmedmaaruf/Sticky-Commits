import { FONTS, CUSTOM_FONT_RE } from './schema.js';

// Fonts the page <head> already loads.
const requested = new Set(['Fredoka', 'Nunito']);

/** CSS font-family stack for a font name. */
export function fontStack(name) {
  const preset = FONTS[name];
  if (preset) return `'${name}', ${preset.fallback}`;
  if (CUSTOM_FONT_RE.test(name || '')) return `'${name}', 'Fredoka', ui-rounded, sans-serif`;
  return `'Fredoka', ui-rounded, sans-serif`;
}

/**
 * Load a Google Font on demand. Each font gets its own <link> so one
 * misspelled custom font can never break the others.
 */
export function ensureFont(name) {
  if (!name || requested.has(name)) return;
  const spec = FONTS[name]?.spec ?? (CUSTOM_FONT_RE.test(name) ? name : null);
  if (!spec) return;
  requested.add(name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${spec.replace(/ /g, '+')}&display=swap`;
  document.head.append(link);
}
