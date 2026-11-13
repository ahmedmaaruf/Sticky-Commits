// ═══════════════════════════════════════════════════════════════
//  Tiny Supabase client (no dependencies) + a safe localStorage helper.
//  Used by likes, comments, access codes and the moderation page.
// ═══════════════════════════════════════════════════════════════

export const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch { /* private mode */ }
  },
};

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
