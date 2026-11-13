// ═══════════════════════════════════════════════════════════════
//  Moderation page — approve, reject or delete comments.
//  Security lives in the database (supabase/setup.sql): only accounts
//  in public.admins can read or change comments, whatever this page does.
// ═══════════════════════════════════════════════════════════════
import { createModeration } from './comments.js';
import { config, $, $$, applySiteText, initTheme, puffTitle, toast } from './common.js';

const mod = createModeration(config);
const queue = $('#queue');
let tab = 'pending';
let cards = new Map();
let busy = false;

applySiteText();
document.title = 'Moderation · Sticky Commits';
puffTitle($('#title'), 'Moderation');
initTheme($('#theme-toggle'));
wire();
cards = await loadCards();
await show();
setInterval(() => { if (document.visibilityState === 'visible' && mod.signedIn() && !busy) refresh(false); }, 30000);

async function loadCards() {
  try {
    const res = await fetch('cards.json', { cache: 'no-cache' });
    const data = await res.json();
    return new Map((data.cards || []).map((c) => [c.id, c]));
  } catch {
    return new Map();
  }
}

function wire() {
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#login-btn');
    const err = $('#login-error');
    btn.disabled = true;
    err.textContent = '';
    try {
      await mod.signIn($('#login-email').value.trim(), $('#login-password').value, $('#login-remember').checked);
      $('#login-password').value = '';
      await show();
    } catch (error) {
      err.textContent = /invalid login/i.test(error.message) ? 'Wrong email or password.' : error.message;
    } finally {
      btn.disabled = false;
    }
  });

  for (const b of $$('[data-tab]')) {
    b.addEventListener('click', () => { tab = b.dataset.tab; refresh(); });
  }
  $('#refresh').addEventListener('click', () => refresh());
  $('#approve-all').addEventListener('click', approveAll);

  queue.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const li = btn.closest('.q-item');
    const id = li.dataset.id;
    const act = btn.dataset.act;
    if (act === 'delete' && !confirm('Delete this comment forever?')) return;
    for (const b of $$('button', li)) b.disabled = true;
    try {
      if (act === 'delete') await mod.remove(id);
      else await mod.setStatus(id, act);
      li.classList.add('leaving');
      setTimeout(() => refresh(false), 280);
      toast({ approved: '✅ Approved — it’s on the wall now', rejected: '🚫 Rejected — hidden from everyone', pending: '↩ Moved back to pending', delete: '🗑 Deleted' }[act]);
    } catch (error) {
      handleError(error);
      for (const b of $$('button', li)) b.disabled = false;
    }
  });
}

async function show() {
  const local = mod.mode === 'local';
  $('#preview-banner').hidden = !local;
  const signedIn = mod.signedIn();
  $('#login').hidden = signedIn;
  $('#panel').hidden = !signedIn;
  if (!signedIn) { $('#login-email').focus(); return; }

  const who = $('#who');
  who.replaceChildren();
  if (!local) {
    who.append(`Signed in as ${mod.email()} · `);
    const out = Object.assign(document.createElement('button'), { type: 'button', className: 'linkish', textContent: 'Sign out' });
    out.addEventListener('click', async () => { await mod.signOut(); show(); });
    who.append(out);
  }
  await refresh();
}

async function refresh(withSpinner = true) {
  busy = true;
  for (const b of $$('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  $('#approve-all').hidden = tab !== 'pending';
  if (withSpinner) queue.replaceChildren(note('Loading…'));
  try {
    const [list, counts] = await Promise.all([mod.list(tab), mod.counts()]);
    for (const [k, v] of Object.entries(counts)) {
      const el = $(`[data-count="${k}"]`);
      if (el) el.textContent = v;
    }
    document.title = `${counts.pending ? `(${counts.pending}) ` : ''}Moderation · Sticky Commits`;
    $('#approve-all').disabled = !counts.pending;
    render(list);
  } catch (error) {
    handleError(error);
  } finally {
    busy = false;
  }
}

function note(text) {
  return Object.assign(document.createElement('li'), { className: 'q-empty', textContent: text });
}

function ago(iso) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function render(list) {
  if (!list.length) {
    queue.replaceChildren(note({
      pending: '🎉 All caught up — no comments waiting.',
      approved: 'No approved comments yet.',
      rejected: 'Nothing rejected. Lovely bunch 💖',
    }[tab]));
    return;
  }
  const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const button = (act, label, cls) => {
    const b = el('button', { type: 'button', className: `btn btn-sm ${cls}`, textContent: label });
    b.dataset.act = act;
    return b;
  };

  queue.replaceChildren(...list.map((c) => {
    const card = cards.get(c.card_id);
    const accent = /^#[0-9a-f]{3,6}$/i.test(card?.colors?.accent || '') ? card.colors.accent : 'var(--lilac)';
    const li = el('li', { className: 'q-item' });
    li.dataset.id = c.id;
    li.style.setProperty('--c', accent);

    const sticker = el('a', { className: 'q-sticker', href: `wall.html#sticker-${c.card_id}`, target: '_blank', rel: 'noopener' },
      el('span', { className: 'q-dot' }), `on ${card?.name || c.card_id}`, el('small', { textContent: ` @${c.card_id} ↗` }));
    const body = el('blockquote', { className: 'q-body', textContent: c.body, dir: 'auto' });
    const meta = el('p', { className: 'q-meta' }, '— ', el('b', { textContent: c.author || 'Anonymous', dir: 'auto' }), ` · ${ago(c.created_at)}`);

    const actions = el('div', { className: 'q-actions' });
    if (tab !== 'approved') actions.append(button('approved', '✅ Approve', 'btn-mint'));
    if (tab === 'approved') actions.append(button('pending', '↩ Unapprove', 'btn-white'));
    if (tab !== 'rejected') actions.append(button('rejected', '🚫 Reject', 'btn-white'));
    actions.append(button('delete', '🗑 Delete', 'btn-white'));

    li.append(sticker, body, meta, actions);
    return li;
  }));
}

async function approveAll() {
  const list = await mod.list('pending');
  if (!list.length || !confirm(`Approve all ${list.length} pending comment${list.length === 1 ? '' : 's'}?`)) return;
  try {
    for (const c of list) await mod.setStatus(c.id, 'approved');
    toast(`✅ Approved ${list.length} comment${list.length === 1 ? '' : 's'}`);
  } catch (error) {
    handleError(error);
  }
  refresh();
}

function handleError(error) {
  console.warn(error);
  if (error.status === 401 || error.status === 403) {
    mod.signOut().then(show);
    toast('Your session ended — please sign in again.');
    return;
  }
  toast(error.message || 'Something went wrong — try again.', 4000);
}
