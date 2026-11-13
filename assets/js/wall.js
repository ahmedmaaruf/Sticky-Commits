// ═══════════════════════════════════════════════════════════════
//  wall.html — the full-screen, explorable sticker board
// ═══════════════════════════════════════════════════════════════
import { stickerReady } from './sticker.js';
import { createLikes } from './likes.js';
import { createComments, COMMENT_MAX } from './comments.js';
import { createAdmin } from './admin.js';
import { createPositions } from './positions.js';
import { store } from './supabase.js';
import { createCamera } from './camera.js';
import { loadCards, createTally } from './data.js';
import { contestInfo, shortLeft, fmtDate, rankCards } from './contest.js';
import { burst, confetti } from './fx.js';
import { config, $, $$, hashNum, applySiteText, initTheme, toast } from './common.js';

const likes = createLikes(config);
const comments = createComments(config);
const tally = createTally(likes);
const admin = createAdmin(config);
const positions = createPositions(admin);
const state = {
  cards: [],
  byId: new Map(),
  talkCounts: {},
  talkCard: null,
  query: '',
  positions: {},   // { cardId: { x, y } } — stickers a moderator has placed by hand
  arranging: false,
};
const GRID = 24;   // Arrange mode snaps to the cutting mat's small squares
let dragEndedAt = 0;
const viewport = $('#canvas');
const world = $('#world');
const talk = $('#talk');
const relTime = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.2-4.4-9.2-8.8C1.4 8.5 3.4 5 6.8 5c2 0 3.4 1.1 4.2 2.4l1 1.4 1-1.4C13.8 6.1 15.2 5 17.2 5c3.4 0 5.4 3.5 4 6.7-2 4.4-9.2 8.8-9.2 8.8z"/></svg>';
const BUBBLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7.5a2.5 2.5 0 0 1-2.5 2.5H11l-4.6 3.6V16.5h0A2.5 2.5 0 0 1 4 14z"/></svg>';

// Layout grid: one cell per sticker (sticker is 220 × 293 + its buttons).
const CELL_W = 300;
const CELL_H = 410;
const coarse = matchMedia('(pointer: coarse)').matches;

const camera = createCamera(viewport, world, {
  rulerX: $('#ruler-x'),
  rulerY: $('#ruler-y'),
  minimap: $('#minimap'),
  zoomLabel: $('#zoom-level'),
});
camera.setExploring(true); // this page is all board: the wheel zooms, one finger pans

const slotOf = (id) => document.getElementById(`sticker-${id}`);

// ── boot ───────────────────────────────────────────────────────
applySiteText();
document.title = `The wall · ${config.title || 'Sticky Commits'}`;
initTheme($('#theme-toggle'));
wireToolbar();
wireCanvasControls();
wireComments();
wireArrange();
wireEasterEgg();
paintContestChip();
setInterval(paintContestChip, 30000);
$('#canvas-hint').textContent = coarse
  ? 'Drag to explore · pinch to zoom · tap a sticker to flip'
  : 'Drag to explore · scroll or pinch to zoom · click a sticker to flip';

try {
  const [cards, placed] = await Promise.all([
    loadCards(config),
    positions.load().catch((err) => { console.warn(err); return {}; }),
    stickerReady,
  ]);
  state.cards = cards;
  state.byId = new Map(cards.map((c) => [c.id, c]));
  state.positions = placed;
  renderBoard();
  if (new URLSearchParams(location.search).has('arrange') && admin.signedIn()) setArranging(true);
  await refreshCounts();
  openFromHash();
} catch (err) {
  console.error(err);
  showMessage('error', err);
}

if (likes.mode === 'shared') {
  setInterval(() => { if (document.visibilityState === 'visible') refreshCounts(); }, 20000);
}

// ── data ───────────────────────────────────────────────────────
async function refreshCounts() {
  const [l, c] = await Promise.allSettled([tally.refresh(), comments.counts()]);
  if (c.status === 'fulfilled') state.talkCounts = c.value;
  if (l.status === 'rejected' || c.status === 'rejected') {
    console.warn(l.reason || c.reason);
    toast('Likes & comments are napping right now 😴 — try again later');
  }
  for (const card of state.cards) { paintLike(card, false); paintTalk(card); }
}

// ── contest chip in the top bar ────────────────────────────────
function paintContestChip() {
  const chip = $('#contest-chip');
  const info = contestInfo(config);
  chip.hidden = !info.enabled;
  if (!info.enabled) return;
  chip.textContent = `🏆 ${shortLeft(info)}`;
  chip.title = info.phase === 'running' ? `Most likes by ${fmtDate(info.end)} wins ${info.prize}` : '';
}

// ── board ──────────────────────────────────────────────────────
function renderBoard() {
  world.replaceChildren();
  if (!state.cards.length) {
    camera.setBounds({ x0: -400, y0: -300, x1: 400, y1: 300 });
    camera.fit(undefined, { animate: false });
    return showMessage('none');
  }

  const newMs = (config.newBadgeDays ?? 4) * 864e5;
  for (const card of state.cards) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.id = `sticker-${card.id}`;
    slot.dataset.id = card.id;
    slot.style.setProperty('--r', `${card.tilt ?? hashNum(card.id, 13) - 6}deg`);
    slot.style.setProperty('--delay', `${hashNum(`${card.id}d`, 160)}ms`);

    const sticker = document.createElement('sticker-card');
    sticker.data = card;

    const like = document.createElement('button');
    like.type = 'button';
    like.className = 'like';
    like.innerHTML = `${HEART}<span class="n">0</span>`;
    like.addEventListener('click', () => toggleLike(card, like));

    const talkBtn = document.createElement('button');
    talkBtn.type = 'button';
    talkBtn.className = 'talk-btn';
    talkBtn.innerHTML = `${BUBBLE}<span class="n">0</span>`;
    talkBtn.addEventListener('click', () => openComments(card));

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(like, talkBtn);
    slot.append(sticker, actions);
    const added = Date.parse(card.added);
    if (!card.demo && added && Date.now() - added < newMs) {
      slot.append(Object.assign(document.createElement('span'), { className: 'new-badge', textContent: 'NEW!' }));
    }
    if (card.demo) slot.append(Object.assign(document.createElement('span'), { className: 'demo-tag', textContent: 'demo' }));
    world.append(slot);
    paintLike(card, false);
    paintTalk(card);
  }

  // place everything instantly the first time, then frame it
  world.classList.add('no-anim');
  layout();
  void world.offsetWidth;
  world.classList.remove('no-anim');
  // start a little zoomed-in so there's something to explore (the minimap shows the rest)
  camera.fit(undefined, { animate: false, min: viewport.clientWidth < 640 ? 0.45 : 0.62 });
  observeSlots();
}

/**
 * Where every sticker sits. Stickers a moderator placed by hand stay exactly
 * there; the rest form a blob that grows outward from the centre (newest in
 * the middle), in brick-offset rows with small nudges, skipping any spot a
 * hand-placed sticker already covers. Same layout for everyone, every visit.
 */
function layout() {
  const cards = sortCards(state.cards);
  const placed = cards.filter((c) => state.positions[c.id]).map((c) => state.positions[c.id]);
  const auto = cards.filter((c) => !state.positions[c.id]);
  const aspect = Math.min(2, Math.max(0.7, viewport.clientWidth / Math.max(1, viewport.clientHeight)));

  const R = Math.ceil(Math.sqrt(cards.length)) + 4;
  const cells = [];
  for (let r = -R; r <= R; r++) {
    for (let c = -R; c <= R; c++) {
      const x = c * CELL_W + (r & 1 ? CELL_W / 2 : 0);
      const y = r * CELL_H;
      cells.push({ x, y, d: Math.hypot(x / aspect, y * 0.9) });
    }
  }
  cells.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  const covered = (cell) => placed.some((p) => Math.abs(p.x - cell.x) < CELL_W * 0.8 && Math.abs(p.y - cell.y) < CELL_H * 0.8);
  const spots = cells.filter((cell) => !covered(cell));

  auto.forEach((card, i) => {
    const { x, y } = spots[i];
    setSlotPos(slotOf(card.id), x + hashNum(`${card.id}x`, 61) - 30, y + hashNum(`${card.id}y`, 41) - 20);
    delete slotOf(card.id).dataset.pinned;
  });
  for (const card of cards) {
    const p = state.positions[card.id];
    if (!p) continue;
    setSlotPos(slotOf(card.id), p.x, p.y);
    slotOf(card.id).dataset.pinned = '';
  }
  refreshBounds();
}

function setSlotPos(slot, x, y) {
  slot.style.setProperty('--x', `${x - 110}px`);
  slot.style.setProperty('--y', `${y - 160}px`);
  slot.dataset.cx = x;
  slot.dataset.cy = y;
}

/** Recompute the camera's limits and the minimap after stickers move. */
function refreshBounds() {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const slot of $$('.slot', world)) {
    const x = +slot.dataset.cx;
    const y = +slot.dataset.cy;
    x0 = Math.min(x0, x - 140); x1 = Math.max(x1, x + 140);
    y0 = Math.min(y0, y - 190); y1 = Math.max(y1, y + 190);
  }
  if (Number.isFinite(x0)) camera.setBounds({ x0, y0, x1, y1 });
  paintDots();
}

function paintDots(dots = null) {
  const q = state.query.trim().toLowerCase();
  const list = dots ?? $$('.slot', world).map((s) => {
    const c = state.byId.get(s.dataset.id);
    return { id: c.id, x: +s.dataset.cx, y: +s.dataset.cy, color: /^#[0-9a-f]{3,6}$/i.test(c.colors.accent) ? c.colors.accent : '#ff6fae' };
  });
  for (const d of list) d.dim = !!q && !matches(state.byId.get(d.id), q);
  camera.setDots(list);
}

function observeSlots() {
  if (!('IntersectionObserver' in window)) { document.body.classList.add('no-io'); return; }
  const io = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e, i) => {
      e.target.style.animationDelay = `${Math.min(i, 10) * 60}ms`;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { root: viewport, rootMargin: '80px' });
  $$('.slot', world).forEach((s) => io.observe(s));
}

/** Newest real stickers first (they land in the middle), demos around the edge. */
function sortCards(list) {
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  return [...list].sort((a, b) => a.demo - b.demo || (b.added || '').localeCompare(a.added || '') || byName(a, b));
}

function boundsOf(slots) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const s of slots) {
    const x = +s.dataset.cx;
    const y = +s.dataset.cy;
    x0 = Math.min(x0, x - 140); x1 = Math.max(x1, x + 140);
    y0 = Math.min(y0, y - 190); y1 = Math.max(y1, y + 190);
  }
  return { x0, y0, x1, y1 };
}

const matches = (c, q) => [c.name, c.title, c.github, c.about, ...c.facts].join(' ').toLowerCase().includes(q);

function applyFilter({ fly = true } = {}) {
  const q = state.query.trim().toLowerCase();
  const hits = [];
  for (const slot of $$('.slot', world)) {
    const ok = !q || matches(state.byId.get(slot.dataset.id), q);
    slot.classList.toggle('dim', !ok);
    if (ok) hits.push(slot);
  }
  paintDots();
  if (!state.cards.length) return;
  if (q && !hits.length) { showMessage('search', q); return; }
  $('#empty').hidden = true;
  if (!fly) return;
  if (!q) camera.fit();
  else if (hits.length === 1) camera.flyTo(+hits[0].dataset.cx, +hits[0].dataset.cy, 1.05);
  else camera.fit(boundsOf(hits));
}

function showMessage(kind, detail) {
  const box = $('#empty');
  box.hidden = false;
  box.replaceChildren();
  const add = (tag, props) => box.appendChild(Object.assign(document.createElement(tag), props));
  if (kind === 'search') {
    add('div', { className: 'big', textContent: '🔍' });
    add('h3', { textContent: 'No sticker matches that' });
    add('p', { textContent: `Nothing found for “${detail}”. Try another name?` });
  } else if (kind === 'error') {
    add('div', { className: 'big', textContent: '🧯' });
    add('h3', { textContent: 'The wall didn’t load' });
    add('p', { textContent: location.protocol === 'file:'
      ? 'Open the site through a local server: run “npm run dev” in the project folder.'
      : `${detail?.message || 'Something went wrong.'} — if you’re running locally, use “npm run dev”.` });
  } else {
    add('div', { className: 'big', textContent: '🫙' });
    add('h3', { textContent: 'The wall is empty… for now!' });
    add('p', { textContent: 'Be the very first sticker — fork the repo, add your folder and open a pull request.' });
    add('a', { className: 'btn', href: './#join', textContent: '🧩 Add the first sticker' });
  }
}

// ── canvas controls ────────────────────────────────────────────
function wireCanvasControls() {
  $('#zoom-in').addEventListener('click', () => camera.zoomBy(1.4));
  $('#zoom-out').addEventListener('click', () => camera.zoomBy(1 / 1.4));
  $('#zoom-level').addEventListener('click', () => camera.zoomTo(1));
  $('#zoom-fit').addEventListener('click', () => camera.fit());
  viewport.focus({ preventScroll: true });
}

// ── ✏️ Arrange mode (moderators only) ──────────────────────────
function wireArrange() {
  const btn = $('#arrange-btn');
  btn.hidden = !admin.signedIn();
  btn.addEventListener('click', () => setArranging(!state.arranging));
  $('#arrange-done').addEventListener('click', () => setArranging(false));
  $('#arrange-reset').addEventListener('click', async () => {
    if (!confirm('Put every sticker back into the automatic layout? Your hand-placed spots will be cleared.')) return;
    arrangeStatus('Resetting…');
    try {
      await positions.reset();
      state.positions = {};
      layout();
      camera.fit();
      arrangeStatus('Back to the automatic layout ✓');
    } catch (err) {
      arrangeStatus(`Couldn’t reset — ${err.message}`, true);
    }
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.arranging && !document.querySelector('dialog[open]')) setArranging(false); });

  // drag a sticker (only while arranging); dragging empty space still pans the mat
  world.addEventListener('pointerdown', startDrag);
  // the click that ends a drag shouldn't flip the sticker
  world.addEventListener('click', (e) => {
    if (Date.now() - dragEndedAt < 350) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  // sign-in box for wall.html?arrange
  const dialog = $('#signin');
  $('#signin-cancel').addEventListener('click', () => dialog.close());
  $('#signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#signin-error');
    const go = $('#signin-btn');
    err.textContent = '';
    go.disabled = true;
    try {
      await admin.signIn($('#signin-email').value.trim(), $('#signin-password').value, $('#signin-remember').checked);
      $('#signin-password').value = '';
      dialog.close();
      btn.hidden = false;
      setArranging(true);
    } catch (error) {
      err.textContent = /invalid login/i.test(error.message) ? 'Wrong email or password.' : error.message;
    } finally {
      go.disabled = false;
    }
  });
  if (new URLSearchParams(location.search).has('arrange') && !admin.signedIn()) {
    if (admin.mode === 'shared') dialog.showModal();
    else toast('In preview mode you can arrange the wall from your own computer (localhost).', 4000);
  }
}

function setArranging(on) {
  if (on && !admin.signedIn()) return;
  state.arranging = on;
  document.body.classList.toggle('arranging', on);
  $('#arrange-bar').hidden = !on;
  const btn = $('#arrange-btn');
  btn.setAttribute('aria-pressed', String(on));
  btn.textContent = on ? '✓ Arranging' : '✏️ Arrange';
  if (on) {
    $$('sticker-card[flipped]', world).forEach((s) => s.flip(false));
    arrangeStatus(admin.mode === 'local' ? 'Preview mode: saved in this browser only' : 'Changes save automatically');
  }
}

function arrangeStatus(text, bad = false) {
  const el = $('#arrange-status');
  el.textContent = text;
  el.classList.toggle('bad', bad);
}

function startDrag(e) {
  if (!state.arranging) return;
  const slot = e.target.closest('.slot');
  if (!slot || e.target.closest('button, a') || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.stopPropagation(); // don't let the mat pan
  e.preventDefault();
  const id = e.pointerId;
  const start = { x: e.clientX, y: e.clientY, cx: +slot.dataset.cx, cy: +slot.dataset.cy, moved: false };
  slot.setPointerCapture(id);
  slot.classList.add('moving');

  const move = (ev) => {
    if (ev.pointerId !== id) return;
    if (!start.moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 4) return;
    start.moved = true;
    let x = start.cx + (ev.clientX - start.x) / camera.scale;
    let y = start.cy + (ev.clientY - start.y) / camera.scale;
    if (!ev.altKey) { x = Math.round(x / GRID) * GRID; y = Math.round(y / GRID) * GRID; }
    setSlotPos(slot, x, y);
  };
  const end = async (ev) => {
    if (ev.pointerId !== id) return;
    slot.removeEventListener('pointermove', move);
    slot.removeEventListener('pointerup', end);
    slot.removeEventListener('pointercancel', end);
    slot.classList.remove('moving');
    if (!start.moved) return; // a plain click still flips the sticker
    dragEndedAt = Date.now();
    // Freeze every sticker that's still automatic at its current spot, so moving
    // one sticker never makes the others shuffle around on the next visit.
    const changed = [slot, ...$$('.slot:not([data-pinned])', world).filter((s) => s !== slot)].map((s) => {
      const p = { id: s.dataset.id, x: Math.round(+s.dataset.cx), y: Math.round(+s.dataset.cy) };
      state.positions[p.id] = { x: p.x, y: p.y };
      s.dataset.pinned = '';
      return p;
    });
    refreshBounds();
    arrangeStatus('Saving…');
    try {
      await positions.save(changed);
      arrangeStatus(admin.mode === 'local' ? 'Saved in this browser ✓' : 'Saved ✓ — everyone sees this layout');
    } catch (err) {
      console.warn(err);
      arrangeStatus(err.status === 401 || err.status === 403 ? 'Your sign-in expired — reload with ?arrange to sign in again.' : `Couldn’t save — ${err.message}`, true);
    }
  };
  slot.addEventListener('pointermove', move);
  slot.addEventListener('pointerup', end);
  slot.addEventListener('pointercancel', end);
}

// ── comments ───────────────────────────────────────────────────
function ago(iso) {
  const s = (Date.parse(iso) - Date.now()) / 1000;
  const steps = [[60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']];
  let v = s;
  for (const [n, unit] of steps) {
    if (Math.abs(v) < n) return relTime.format(Math.round(v), unit);
    v /= n;
  }
  return '';
}

function paintTalk(card) {
  const btn = slotOf(card.id)?.querySelector('.talk-btn');
  if (!btn) return;
  const n = state.talkCounts[card.id] || 0;
  btn.querySelector('.n').textContent = n;
  btn.setAttribute('aria-label', `${n} ${n === 1 ? 'comment' : 'comments'} on ${card.name}'s sticker — open comments`);
}

function wireComments() {
  const form = $('#talk-form');
  const body = $('#talk-body');
  const name = $('#talk-name');
  const count = $('#talk-count');
  const status = $('#talk-status');
  name.value = store.get('sw:my-name', '');

  $('#talk-close').addEventListener('click', () => talk.close());
  talk.addEventListener('click', (e) => { if (e.target === talk) talk.close(); }); // click the dimmed backdrop
  talk.addEventListener('close', () => { state.talkCard = null; });
  body.addEventListener('input', () => {
    count.textContent = `${body.value.length} / ${COMMENT_MAX}`;
    count.classList.toggle('full', body.value.length >= COMMENT_MAX);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const card = state.talkCard;
    if (!card) return;
    if ($('#talk-website').value) { talk.close(); return; } // a bot filled the hidden field
    const send = $('#talk-send');
    send.disabled = true;
    status.className = 'talk-status';
    status.textContent = 'Sending…';
    try {
      await comments.add(card.id, body.value, name.value);
      store.set('sw:my-name', name.value.trim());
      body.value = '';
      body.dispatchEvent(new Event('input'));
      status.className = 'talk-status ok';
      status.textContent = '💌 Sent! It will appear for everyone once a moderator approves it.';
      await renderTalkList(card);
      const r = send.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top, { emojis: ['💌', '✨', '💬'], count: 9 });
    } catch (err) {
      status.className = 'talk-status bad';
      status.textContent = err.message || 'Couldn’t send that — try again in a moment.';
    } finally {
      setTimeout(() => { send.disabled = false; }, 1500);
    }
  });
}

async function openComments(card) {
  state.talkCard = card;
  $('#talk-title').textContent = card.name;
  $('#talk-sub').textContent = card.title || (card.github ? `@${card.github}` : '');
  const mini = document.createElement('sticker-card');
  mini.data = card;
  $('#talk-sticker').replaceChildren(mini);
  $('#talk-status').textContent = '';
  if (!talk.open) talk.showModal();
  await renderTalkList(card);
}

async function renderTalkList(card) {
  const list = $('#talk-list');
  list.replaceChildren(Object.assign(document.createElement('li'), { className: 'talk-empty', textContent: 'Loading comments…' }));
  let approved = [];
  try {
    approved = await comments.list(card.id);
  } catch (err) {
    console.warn(err);
    list.replaceChildren(Object.assign(document.createElement('li'), { className: 'talk-empty', textContent: 'Comments are napping right now 😴 — try again later.' }));
    return;
  }
  if (state.talkCard?.id !== card.id) return; // closed or switched meanwhile
  state.talkCounts[card.id] = approved.length;
  paintTalk(card);

  const mine = comments.myPending(card.id, approved);
  const item = (c, pending) => {
    const who = c.author || 'Anonymous';
    const li = document.createElement('li');
    li.className = `talk-item${pending ? ' pending' : ''}`;
    const av = document.createElement('span');
    av.className = 'talk-avatar';
    av.textContent = c.author ? [...c.author][0].toUpperCase() : '🕶️';
    av.style.setProperty('--c', ['var(--pink)', 'var(--lilac)', 'var(--sky-d)', 'var(--mint-d)', 'var(--peach-d)', 'var(--butter-d)'][hashNum(who, 6)]);
    const bubble = document.createElement('div');
    bubble.className = 'talk-bubble';
    const meta = document.createElement('div');
    meta.className = 'talk-meta';
    meta.append(Object.assign(document.createElement('b'), { textContent: who, dir: 'auto' }));
    meta.append(Object.assign(document.createElement('time'), { dateTime: c.created_at, textContent: ago(c.created_at) }));
    if (pending) meta.append(Object.assign(document.createElement('span'), { className: 'talk-badge', textContent: '⏳ waiting for approval · only you see this' }));
    bubble.append(meta, Object.assign(document.createElement('p'), { textContent: c.body, dir: 'auto' }));
    li.append(av, bubble);
    return li;
  };

  const items = [...approved.map((c) => item(c, false)), ...mine.map((c) => item(c, true))];
  if (!items.length) {
    items.push(Object.assign(document.createElement('li'), { className: 'talk-empty', textContent: 'No comments yet — be the first to say something nice ✨' }));
  }
  list.replaceChildren(...items);
  list.scrollTop = list.scrollHeight;
}

// ── likes ──────────────────────────────────────────────────────
function paintLike(card, bump = true) {
  const btn = slotOf(card.id)?.querySelector('.like');
  if (!btn) return;
  const n = tally.count(card);
  const on = likes.isLiked(card.id);
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', `${on ? 'Unlike' : 'Like'} ${card.name}'s sticker (${n} ${n === 1 ? 'like' : 'likes'})`);
  const label = btn.querySelector('.n');
  if (label.textContent !== String(n)) {
    label.textContent = n;
    if (bump) { label.classList.remove('bump'); void label.offsetWidth; label.classList.add('bump'); }
  }
}

async function toggleLike(card, btn) {
  const info = contestInfo(config);
  if (info.enabled && !info.votingOpen) {
    if (info.phase === 'before') toast(`🗓️ Voting opens ${fmtDate(info.start)} — get your sticker in first!`, 3200);
    else {
      const winner = rankCards(state.cards, tally.count, tally.last)[0];
      toast(`🏁 Voting has closed${winner ? ` — congrats ${winner.name}! 🏆` : '.'}`, 3200);
    }
    return;
  }
  if (btn.dataset.busy) return;
  btn.dataset.busy = '1';
  const wasLiked = likes.isLiked(card.id);
  const prev = tally.raw(card.id);

  // optimistic update — feels instant
  tally.set(card.id, Math.max(0, prev + (wasLiked ? -1 : 1)));
  btn.setAttribute('aria-pressed', String(!wasLiked));
  paintLike(card);
  if (!wasLiked) {
    btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
    const r = btn.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
  }

  try {
    const res = await likes.toggle(card.id);
    tally.set(card.id, res.total);
  } catch (err) {
    console.warn(err);
    tally.set(card.id, prev);
    if (/closed|opened/i.test(err.message)) toast(`🏁 ${err.message}`, 3200);
    else if (/slow down|isn.t on the wall/i.test(err.message)) toast(`🐢 ${err.message[0].toUpperCase()}${err.message.slice(1)}`, 3600);
    else toast('Couldn’t save that like — check your connection 💔');
  } finally {
    delete btn.dataset.busy;
    paintLike(card, false);
  }
}

// ── toolbar ────────────────────────────────────────────────────
function wireToolbar() {
  let t;
  const search = $('#search');
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { state.query = search.value; applyFilter(); }, 300);
  });
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    clearTimeout(t);
    state.query = search.value;
    applyFilter({ fly: false });
    const first = $$('.slot:not(.dim)', world)[0];
    if (first && state.query.trim()) spotlight(first.dataset.id);
  });

  $('#surprise').addEventListener('click', () => {
    const visible = $$('.slot:not(.dim)', world);
    if (!visible.length) return;
    spotlight(visible[Math.floor(Math.random() * visible.length)].dataset.id);
  });

  document.addEventListener('sticker-share', async (e) => {
    const url = new URL(`wall.html#sticker-${e.detail.id}`, location.href).href;
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied — go share the love 💌');
    } catch {
      toast(url, 6000);
    }
  });
}

/** Fly the camera to a sticker, make it glow, and flip it over. */
async function spotlight(id) {
  const slot = slotOf(id);
  if (!slot) return;
  if (slot.classList.contains('dim')) { $('#search').value = ''; state.query = ''; applyFilter({ fly: false }); }
  $$('sticker-card[flipped]', world).forEach((s) => s.flip(false));
  await camera.flyTo(+slot.dataset.cx, +slot.dataset.cy, Math.max(camera.scale, 1.1));
  slot.classList.remove('spot');
  void slot.offsetWidth;
  slot.classList.add('spot');
  setTimeout(() => slot.querySelector('sticker-card')?.flip(true), 250);
  setTimeout(() => slot.classList.remove('spot'), 3400);
}

function openFromHash() {
  const m = location.hash.match(/^#sticker-(.+)$/);
  if (m && state.byId.has(decodeURIComponent(m[1]))) setTimeout(() => spotlight(decodeURIComponent(m[1])), 400);
}

// ── 🤫 type "git push" anywhere ────────────────────────────────
function wireEasterEgg() {
  let typed = '';
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).replace(/\s+/g, '').slice(-10);
    if (!typed.endsWith('gitpush')) return;
    typed = '';
    confetti();
    toast('🚀 Pushed to main! Everything is deployed. (Not really… but you deserve it.)', 3800);
    $$('.slot', world).forEach((s, i) => {
      setTimeout(() => {
        s.classList.remove('jump'); void s.offsetWidth; s.classList.add('jump');
      }, (i % 12) * 60);
    });
  });
}
