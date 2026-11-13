// ═══════════════════════════════════════════════════════════════
//  Likes.
//
//  • "shared" mode  — talks to a tiny Supabase database (see supabase/setup.sql).
//    Every like is sent with the visitor's 6-digit access code (access.js),
//    so each code can like each sticker once. The database only ever hands
//    out COUNTS, so nobody can see who liked what.
//  • "local" mode   — used until Supabase is configured. Likes are kept in this
//    browser only, so the wall still works for previews.
// ═══════════════════════════════════════════════════════════════
import { store, supabase } from './supabase.js';

const needCode = () => Object.assign(new Error('Enter your code to like stickers'), { needCode: true });
const badCode = () => Object.assign(new Error('That code doesn’t work anymore'), { badCode: true });

/** `access` is the code keeper from access.js. */
export function createLikes(config = {}, access = null) {
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
      /** Which stickers this code has liked, so the hearts match on every device. */
      async syncMine() {
        const code = access?.code();
        const rows = code ? await db.rpc('my_likes', { p_code: code }) : [];
        liked.clear();
        for (const r of rows || []) liked.add(r.card_id);
        saveLiked();
      },
      async toggle(id) {
        const code = access?.code();
        if (!code) throw needCode();
        const res = await db.rpc('toggle_like', { p_card: id, p_code: code });
        if (!res?.ok) {
          access.forget();
          liked.clear();
          saveLiked();
          throw badCode();
        }
        if (res.liked) liked.add(id); else liked.delete(id);
        saveLiked();
        return { liked: !!res.liked, total: Number(res.total) || 0 };
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
    async syncMine() {},
    async toggle(id) {
      if (liked.has(id)) liked.delete(id); else liked.add(id);
      saveLiked();
      return { liked: liked.has(id), total: liked.has(id) ? 1 : 0 };
    },
  };
}
