// ═══════════════════════════════════════════════════════════════
//  Anonymous likes.
//
//  • "shared" mode  — talks to a tiny Supabase database (see supabase/setup.sql).
//    Nobody can see WHO liked a sticker: each browser gets a random id, and
//    the database only ever hands out counts.
//  • "local" mode   — used until Supabase is configured. Likes are kept in this
//    browser only, so the wall still works for previews.
// ═══════════════════════════════════════════════════════════════
import { store, voterId, supabase } from './supabase.js';

export function createLikes(config = {}) {
  const liked = new Set(store.get('sw:liked', []));
  const saveLiked = () => store.set('sw:liked', [...liked]);
  const db = supabase(config);

  if (db) {
    return {
      mode: 'shared',
      isLiked: (id) => liked.has(id),
      /** { totals: {card: n}, last: {card: iso} } — `last` is when the newest like arrived (tie-break). */
      async counts() {
        const rows = await db.rpc('like_counts');
        return {
          totals: Object.fromEntries(rows.map((r) => [r.card_id, Number(r.total) || 0])),
          last: Object.fromEntries(rows.map((r) => [r.card_id, r.last_at])),
        };
      },
      async toggle(id) {
        const rows = await db.rpc('toggle_like', { p_card: id, p_voter: voterId() });
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (row.is_liked) liked.add(id); else liked.delete(id);
        saveLiked();
        return { liked: !!row.is_liked, total: Number(row.total) || 0 };
      },
    };
  }

  // ── local preview mode ──
  return {
    mode: 'local',
    isLiked: (id) => liked.has(id),
    async counts() {
      return { totals: Object.fromEntries([...liked].map((id) => [id, 1])), last: {} };
    },
    async toggle(id) {
      if (liked.has(id)) liked.delete(id); else liked.add(id);
      saveLiked();
      return { liked: liked.has(id), total: liked.has(id) ? 1 : 0 };
    },
  };
}
