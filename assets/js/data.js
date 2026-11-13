// Shared data helpers for the home page and the wall.
import { normalizeCard } from './sticker.js';
import { hashNum } from './common.js';

/** Load every sticker from cards.json (demos only while there are few real stickers). */
export async function loadCards(config) {
  const res = await fetch('cards.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load cards.json (${res.status})`);
  const data = await res.json();
  const all = (data.cards || []).map(normalizeCard);
  const real = all.filter((c) => !c.demo);
  const mode = config.showDemoCards ?? 'auto';
  const showDemos = mode === true || (mode === 'auto' && real.length < 5);
  return showDemos ? [...real, ...all.filter((c) => c.demo)] : real;
}

/** Like counts for every sticker (+ when each got its latest like, for contest tie-breaks). */
export function createTally(likes) {
  let totals = {};
  let last = {};
  // Demo stickers get a few pretend likes in local preview mode so the podium has something to show.
  const seed = (card) => (likes.mode === 'local' && card.demo ? 4 + hashNum(card.id, 37) : 0);
  return {
    count: (card) => (totals[card.id] || 0) + seed(card),
    last: (card) => (last[card.id] ? Date.parse(last[card.id]) : undefined),
    raw: (id) => totals[id] || 0,
    set(id, total) {
      if (total > (totals[id] || 0)) last[id] = new Date().toISOString();
      totals[id] = total;
    },
    async refresh() {
      const r = await likes.counts();
      totals = r.totals || {};
      last = r.last || {};
    },
  };
}
