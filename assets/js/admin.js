// ═══════════════════════════════════════════════════════════════
//  Moderator sign-in, shared by moderate.html and the wall's Arrange mode.
//
//  The real protection lives in the database (supabase/setup.sql): only
//  accounts listed in public.admins can change comments or the layout.
//  This module just keeps the moderator's session.
// ═══════════════════════════════════════════════════════════════
import { supabase } from './supabase.js';

const KEY = 'sw:mod-session';
const isLocalHost = () => ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);

export function createAdmin(config = {}) {
  const db = supabase(config);

  // Preview mode (no Supabase yet): everything is stored in this browser only,
  // so "being a moderator" just means using the site on your own computer.
  if (!db) {
    return {
      mode: 'local',
      db: null,
      signedIn: () => isLocalHost(),
      email: () => 'preview mode',
      async signIn() {},
      async signOut() {},
      authed: (fn) => fn(null),
    };
  }

  // A session lives in sessionStorage (ends with the tab) unless "keep me signed in" was ticked.
  const read = (s) => { try { return JSON.parse(s.getItem(KEY)); } catch { return null; } };
  let session = read(sessionStorage) || read(localStorage);
  const save = (s) => {
    try {
      sessionStorage.removeItem(KEY);
      localStorage.removeItem(KEY);
      if (s) (s.remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s));
    } catch { /* storage blocked */ }
  };

  const keep = (res, remember = session?.remember) => {
    session = {
      access_token: res.access_token,
      refresh_token: res.refresh_token,
      expires_at: Date.now() + (Number(res.expires_in) || 3600) * 1000,
      email: res.user?.email || session?.email || '',
      remember: !!remember,
    };
    save(session);
  };

  async function token() {
    if (!session) throw Object.assign(new Error('Please sign in again'), { status: 401 });
    if (Date.now() > session.expires_at - 60_000) keep(await db.refresh(session.refresh_token));
    return session.access_token;
  }

  const admin = {
    mode: 'shared',
    db,
    signedIn: () => !!session,
    email: () => session?.email || '',
    async signIn(email, password, remember = false) {
      keep(await db.signIn(email, password), remember);
      const ok = await db.rpc('is_admin', {}, session.access_token);
      if (!ok) {
        await admin.signOut();
        throw new Error('This account isn’t a moderator yet — run the “make yourself an admin” query from the README.');
      }
    },
    async signOut() {
      if (session) await db.signOut(session.access_token);
      session = null;
      save(null);
    },
    /** Run a request with a fresh moderator token (refreshes once if it went stale). */
    async authed(fn) {
      try {
        return await fn(await token());
      } catch (err) {
        if (err.status !== 401 || !session) throw err;
        keep(await db.refresh(session.refresh_token));
        return fn(session.access_token);
      }
    },
  };
  return admin;
}
