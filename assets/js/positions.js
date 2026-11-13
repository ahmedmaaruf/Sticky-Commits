// ═══════════════════════════════════════════════════════════════
//  Where moderators have placed stickers on the wall.
//  Everyone can READ the layout; only moderators can change it.
//  Positions are world coordinates of each sticker's centre.
// ═══════════════════════════════════════════════════════════════
import { store } from './supabase.js';

const LOCAL_KEY = 'sw:local-positions';

export function createPositions(admin) {
  const db = admin.db;

  if (!db) {
    return {
      mode: 'local',
      async load() { return store.get(LOCAL_KEY, {}); },
      /** list: [{ id, x, y }] */
      async save(list) {
        const all = store.get(LOCAL_KEY, {});
        for (const p of list) all[p.id] = { x: p.x, y: p.y };
        store.set(LOCAL_KEY, all);
      },
      async reset() { store.set(LOCAL_KEY, {}); },
    };
  }

  return {
    mode: 'shared',
    async load() {
      const rows = await db.rest('card_positions?select=card_id,x,y&limit=5000');
      return Object.fromEntries(rows.map((r) => [r.card_id, { x: Number(r.x), y: Number(r.y) }]));
    },
    /** list: [{ id, x, y }] — saved in one request (insert or update) */
    save: (list) => admin.authed((t) => db.rest('card_positions', {
      method: 'POST',
      token: t,
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: list.map((p) => ({ card_id: p.id, x: p.x, y: p.y, updated_at: new Date().toISOString() })),
    })),
    // Supabase refuses DELETE without a filter, so "every row" is spelled card_id IS NOT NULL.
    reset: () => admin.authed((t) => db.rest('card_positions?card_id=not.is.null', { method: 'DELETE', token: t, prefer: 'return=minimal' })),
  };
}
