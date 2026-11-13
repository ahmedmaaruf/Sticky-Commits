// ═══════════════════════════════════════════════════════════════
//  Moderated comments.
//
//  Everyone can WRITE a comment, but it's saved as "pending" and only
//  shows up after a moderator approves it on moderate.html.
//
//  • shared mode → Supabase (see supabase/setup.sql)
//  • local mode  → stored in this browser only, so you can try the whole
//                  comment → approve flow before Supabase is set up.
// ═══════════════════════════════════════════════════════════════
import { store, supabase } from './supabase.js';
import { createAdmin } from './admin.js';

export const COMMENT_MAX = 280;
export const NAME_MAX = 40;
const LOCAL_KEY = 'sw:local-comments';
const MINE_KEY = 'sw:my-comments';
const MINE_DAYS = 14;

const localAll = () => store.get(LOCAL_KEY, []);
const localSave = (list) => store.set(LOCAL_KEY, list);
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').trim().slice(0, max);

/**
 * Public side: read approved comments, send new (pending) ones.
 * `access` is the code keeper from access.js — sending needs a code.
 */
export function createComments(config = {}, access = null) {
  const db = supabase(config);

  const backend = db ? {
    mode: 'shared',
    async counts() {
      const rows = await db.rpc('comment_counts');
      return Object.fromEntries(rows.map((r) => [r.card_id, Number(r.total) || 0]));
    },
    list: (card) => db.rpc('card_comments', { p_card: card }),
    async send(card, body, author) {
      const code = access?.code();
      if (!code) throw Object.assign(new Error('Enter your code to comment'), { needCode: true });
      const id = await db.rpc('add_comment', { p_card: card, p_body: body, p_author: author || null, p_code: code });
      if (id == null) {
        access.forget();
        throw Object.assign(new Error('That code doesn’t work anymore'), { badCode: true });
      }
      return id;
    },
  } : {
    mode: 'local',
    async counts() {
      const out = {};
      for (const c of localAll()) if (c.status === 'approved') out[c.card_id] = (out[c.card_id] || 0) + 1;
      return out;
    },
    async list(card) {
      return localAll().filter((c) => c.card_id === card && c.status === 'approved')
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    },
    async send(card, body, author) {
      const all = localAll();
      const id = Date.now();
      all.push({ id, card_id: card, body, author: author || null, status: 'pending', created_at: new Date().toISOString() });
      localSave(all);
      return id;
    },
  };

  return {
    mode: backend.mode,
    counts: backend.counts,
    list: backend.list,
    /** Send a comment. It stays invisible to everyone else until approved. */
    async add(card, body, author) {
      const b = clean(body, COMMENT_MAX);
      const a = clean(author, NAME_MAX);
      if (b.length < 2) throw new Error('Write a little more first 🙂');
      const id = await backend.send(card, b, a);
      const mine = store.get(MINE_KEY, []);
      mine.push({ id, card, body: b, author: a || null, created_at: new Date().toISOString() });
      store.set(MINE_KEY, mine.slice(-50));
      return id;
    },
    /** Comments this browser sent to `card` that aren't approved yet (only you see these). */
    myPending(card, approved) {
      const ids = new Set(approved.map((c) => String(c.id)));
      const cutoff = Date.now() - MINE_DAYS * 864e5;
      const keep = store.get(MINE_KEY, []).filter((c) => !ids.has(String(c.id)) && Date.parse(c.created_at) > cutoff);
      store.set(MINE_KEY, keep);
      return keep.filter((c) => c.card === card);
    },
  };
}

/** Moderator side (moderate.html): sign in, list, approve / reject / delete. */
export function createModeration(config = {}) {
  const db = supabase(config);

  if (!db) {
    const update = (fn) => { localSave(fn(localAll())); };
    return {
      mode: 'local',
      signedIn: () => true, // the moderation page always works in preview mode
      email: () => 'preview mode',
      async list(status) {
        return localAll().filter((c) => c.status === status)
          .sort((a, b) => (status === 'pending' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)));
      },
      async counts() {
        const out = { pending: 0, approved: 0, rejected: 0 };
        for (const c of localAll()) out[c.status] = (out[c.status] || 0) + 1;
        return out;
      },
      async setStatus(id, status) {
        update((all) => all.map((c) => (String(c.id) === String(id) ? { ...c, status, reviewed_at: new Date().toISOString() } : c)));
      },
      async remove(id) { update((all) => all.filter((c) => String(c.id) !== String(id))); },
      async signIn() {},
      async signOut() {},
    };
  }

  // Sign-in is shared with the wall's Arrange mode (see admin.js).
  const admin = createAdmin(config);
  const authed = (fn) => admin.authed(fn);

  const cols = 'id,card_id,author,body,status,created_at,reviewed_at';
  return {
    mode: 'shared',
    signedIn: admin.signedIn,
    email: admin.email,
    signIn: (email, password, remember) => admin.signIn(email, password, remember),
    signOut: () => admin.signOut(),
    list: (status) => authed((t) => db.rest(
      `comments?select=${cols}&status=eq.${status}&order=created_at.${status === 'pending' ? 'asc' : 'desc'}&limit=500`, { token: t })),
    async counts() {
      const rows = await authed((t) => db.rest('comments?select=status&limit=5000', { token: t }));
      const out = { pending: 0, approved: 0, rejected: 0 };
      for (const r of rows) out[r.status] = (out[r.status] || 0) + 1;
      return out;
    },
    setStatus: (id, status) => authed((t) => db.rest(`comments?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', token: t, prefer: 'return=minimal', body: { status, reviewed_at: new Date().toISOString() },
    })),
    remove: (id) => authed((t) => db.rest(`comments?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', token: t, prefer: 'return=minimal' })),
  };
}
