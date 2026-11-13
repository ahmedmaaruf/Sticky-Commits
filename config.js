// ┌───────────────────────────────────────────────────────────┐
// │  🎛️  Sticker Wall settings — the only file admins edit.   │
// └───────────────────────────────────────────────────────────┘
window.STICKER_WALL = {
  // Big puffy title at the top of the page.
  title: 'Sticky Commits',

  // The title's gradient, left → right (2 or more hex colours).
  titleGradient: ['#5b4bff', '#a04dff', '#ff5fa2'],

  // Shown under the title.
  tagline: 'One sticker wall for every stage — every sticker is a pull request.',

  // Who the wall is for (shown as a little chip and in the footer).
  className: 'Informatics students',

  // "owner/repo" on GitHub. Leave empty to auto-detect when hosted on GitHub Pages.
  repo: 'ahmedmaaruf/Sticky-Commits',
  branch: 'main',

  // Demo stickers: true, false, or 'auto' (shown only until 5 real stickers exist).
  showDemoCards: 'auto',

  // Stickers added within this many days get a "NEW!" starburst.
  newBadgeDays: 4,

  // 🏆 The contest. Likes only count between `start` and `end`
  // (also set the same `end` in Supabase — see README → "Contest dates").
  // Times include the time zone (+03:00), so everyone sees the same deadline.
  contest: {
    enabled: true,
    start: '2026-11-12T00:00:00+03:00',
    end: '2026-12-12T23:59:59+03:00',
    prize: '1 month of Claude',
    prizeDetail: 'A one-month Claude subscription for the maker of the most-loved sticker.',
  },

  // Shared, anonymous likes (see README → "Turn on shared likes").
  // Until this is filled in, likes are only saved in each visitor's own browser.
  supabase: {
    url: '',      // e.g. 'https://abcdefghijkl.supabase.co'
    anonKey: '',  // the "anon" / "publishable" key — it's safe to commit
  },
};
