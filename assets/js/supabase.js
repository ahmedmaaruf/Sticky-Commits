// ═══════════════════════════════════════════════════════════════
//  Tiny Supabase client (no dependencies) + the anonymous browser id.
//  Used by likes, comments and the moderation page.
// ═══════════════════════════════════════════════════════════════

export const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
  },
};

function randomId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A random id for this browser. It never contains anything about the person. */
export function voterId() {
  let id = store.get('sw:voter', null);
  if (!id) { id = randomId(); store.set('sw:voter', id); }
  return id;
}

/** Returns null when Supabase isn't configured (→ local preview mode). */
export function supabase(config = {}) {
  const url = (config.supabase?.url || '').trim().replace(/\/+$/, '');
  const key = (config.supabase?.anonKey || '').trim();
  if (!url || !key) return null;

  const headers = (token) => {
    const h = { apikey: key, 'Content-Type': 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    else if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`; // legacy JWT anon keys
    return h;
  };

  async function call(path, { method = 'GET', body, token, prefer } = {}) {
    const h = headers(token);
    if (prefer) h.Prefer = prefer;
    const res = await fetch(`${url}${path}`, { method, headers: h, body: body == null ? undefined : JSON.stringify(body) });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error(data?.message || data?.msg || data?.error_description || `Server said ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    rpc: (fn, body = {}, token) => call(`/rest/v1/rpc/${fn}`, { method: 'POST', body, token }),
    rest: (path, opts) => call(`/rest/v1/${path}`, opts),
    signIn: (email, password) => call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } }),
    refresh: (refreshToken) => call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refreshToken } }),
    signOut: (token) => call('/auth/v1/logout', { method: 'POST', token }).catch(() => {}),
  };
}
