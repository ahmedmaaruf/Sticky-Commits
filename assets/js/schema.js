// ─────────────────────────────────────────────────────────────
//  The rules for a sticker card.
//  Shared by the website (browser) AND scripts/build.mjs (Node),
//  so the PR checker and the board always agree.
// ─────────────────────────────────────────────────────────────

export const SHAPES = {
  classic:  'Rounded sticker with a photo window',
  polaroid: 'Instant photo with a handwritten caption',
  badge:    'Round badge — your name curves around the edge',
  ticket:   'Admit-one ticket with punched notches',
  blob:     'Wobbly jelly blob that slowly morphs',
  cutout:   'Die-cut around your picture (best with transparent PNGs)',
};

export const FINISHES = {
  matte:   'Soft paper, no shine',
  glossy:  'Shiny, catches the light',
  holo:    'Rainbow holographic foil',
  glitter: 'Sparkly glitter that twinkles',
};

export const PATTERNS = ['none', 'dots', 'grid', 'stripes', 'checker', 'hearts', 'stars', 'waves', 'rays'];
export const ATTACH = ['tape', 'pin', 'none'];
export const IMAGE_FITS = ['cover', 'contain'];
export const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'];

export const LIMITS = {
  name: 40,
  title: 60,
  about: 220,
  fact: 50,
  facts: 3,
  emoji: 16,
  color: 200,
  tilt: 12,
  imageBytes: 2_000_000,
  imageWarnBytes: 800_000,
  cssBytes: 20_000,
};

// GitHub usernames: letters, digits, single hyphens, max 39 chars. Folders are lowercase.
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/;

export const DEFAULTS = {
  shape: 'classic',
  finish: 'glossy',
  pattern: 'dots',
  font: 'Fredoka',
  attach: 'tape',
  emoji: '✨',
  imageFit: 'cover',
  colors: { background: '#ffd6ec', text: '#3b1f4a', accent: '#ff5fa2' },
};

export const KNOWN_KEYS = [
  '$schema', 'name', 'title', 'github', 'image', 'imageFit', 'imagePosition', 'emoji',
  'shape', 'finish', 'pattern', 'font', 'colors', 'attach', 'tilt', 'about', 'facts', 'css',
];
export const COLOR_KEYS = ['background', 'text', 'accent', 'name'];

// Google Fonts presets. `spec` is the css2 "family=" value; `group` is just for the docs.
export const FONTS = {
  'Fredoka':            { spec: 'Fredoka:wght@600',          group: 'Bubbly',      fallback: 'ui-rounded, sans-serif' },
  'Chewy':              { spec: 'Chewy',                     group: 'Bubbly',      fallback: 'ui-rounded, sans-serif' },
  'Bagel Fat One':      { spec: 'Bagel Fat One',             group: 'Bubbly',      fallback: 'ui-rounded, sans-serif' },
  'Sniglet':            { spec: 'Sniglet:wght@800',          group: 'Bubbly',      fallback: 'ui-rounded, sans-serif' },
  'Mochiy Pop One':     { spec: 'Mochiy Pop One',            group: 'Bubbly',      fallback: 'ui-rounded, sans-serif' },
  'Baloo 2':            { spec: 'Baloo 2:wght@800',          group: 'Bubbly',      fallback: 'ui-rounded, sans-serif' },
  'Comfortaa':          { spec: 'Comfortaa:wght@700',        group: 'Bubbly',      fallback: 'ui-rounded, sans-serif' },
  'Caveat':             { spec: 'Caveat:wght@700',           group: 'Handwritten', fallback: 'cursive' },
  'Pacifico':           { spec: 'Pacifico',                  group: 'Handwritten', fallback: 'cursive' },
  'Permanent Marker':   { spec: 'Permanent Marker',          group: 'Handwritten', fallback: 'cursive' },
  'Gloria Hallelujah':  { spec: 'Gloria Hallelujah',         group: 'Handwritten', fallback: 'cursive' },
  'Indie Flower':       { spec: 'Indie Flower',              group: 'Handwritten', fallback: 'cursive' },
  'Gaegu':              { spec: 'Gaegu:wght@700',            group: 'Handwritten', fallback: 'cursive' },
  'Press Start 2P':     { spec: 'Press Start 2P',            group: 'Retro',       fallback: 'monospace' },
  'Silkscreen':         { spec: 'Silkscreen',                group: 'Retro',       fallback: 'monospace' },
  'Bungee':             { spec: 'Bungee',                    group: 'Retro',       fallback: 'sans-serif' },
  'Monoton':            { spec: 'Monoton',                   group: 'Retro',       fallback: 'sans-serif' },
  'Righteous':          { spec: 'Righteous',                 group: 'Retro',       fallback: 'sans-serif' },
  'Orbitron':           { spec: 'Orbitron:wght@800',         group: 'Retro',       fallback: 'sans-serif' },
  'Shrikhand':          { spec: 'Shrikhand',                 group: 'Bold',        fallback: 'serif' },
  'Lobster':            { spec: 'Lobster',                   group: 'Bold',        fallback: 'cursive' },
  'Abril Fatface':      { spec: 'Abril Fatface',             group: 'Bold',        fallback: 'serif' },
  'Rubik Mono One':     { spec: 'Rubik Mono One',            group: 'Bold',        fallback: 'sans-serif' },
  'Archivo Black':      { spec: 'Archivo Black',             group: 'Bold',        fallback: 'sans-serif' },
  'Space Mono':         { spec: 'Space Mono:wght@700',       group: 'Code',        fallback: 'monospace' },
  'JetBrains Mono':     { spec: 'JetBrains Mono:wght@800',   group: 'Code',        fallback: 'monospace' },
  'Lalezar':            { spec: 'Lalezar',                   group: 'Arabic',      fallback: 'sans-serif' },
  'Marhey':             { spec: 'Marhey:wght@600',           group: 'Arabic',      fallback: 'sans-serif' },
  'Baloo Bhaijaan 2':   { spec: 'Baloo Bhaijaan 2:wght@800', group: 'Arabic',      fallback: 'sans-serif' },
  'Cairo':              { spec: 'Cairo:wght@800',            group: 'Arabic',      fallback: 'sans-serif' },
  'Tajawal':            { spec: 'Tajawal:wght@800',          group: 'Arabic',      fallback: 'sans-serif' },
  'Reem Kufi':          { spec: 'Reem Kufi:wght@700',        group: 'Arabic',      fallback: 'sans-serif' },
  'Rakkas':             { spec: 'Rakkas',                    group: 'Arabic',      fallback: 'serif' },
};

// Any other Google Font name is allowed too, as long as it looks like a font name.
export const CUSTOM_FONT_RE = /^[A-Za-z0-9 ]{2,40}$/;

export const isCssValueSafe = (v) => typeof v === 'string' && v.length <= LIMITS.color && !/[;{}<>\\]/.test(v);
