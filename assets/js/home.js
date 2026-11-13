// ═══════════════════════════════════════════════════════════════
//  index.html — hero, the 🏆 contest (prize ticket + countdown + leader),
//  the race podium and the "how to join" guide.
// ═══════════════════════════════════════════════════════════════
import { stickerReady } from './sticker.js';
import { createLikes } from './likes.js';
import { loadCards, createTally } from './data.js';
import { contestInfo, rankCards, timeLeft, fmtDate, shortLeft } from './contest.js';
import { confetti } from './fx.js';
import { config, $, applySiteText, initTheme, initParallax, initStickyHeader, puffTitle, toast } from './common.js';

const likes = createLikes(config);
const tally = createTally(likes);
let cards = [];
let podiumKey = '';
let leaderKey = '';
// Spark rays of slightly different lengths give it a hand-drawn feel.
const RAYS = [44, 33, 41, 30, 45, 35, 42, 31, 43, 34, 40, 32];

// Preview the contest page in another phase: ?contest-preview=before | ended
const preview = new URLSearchParams(location.search).get('contest-preview');
const base = contestInfo(config);
const now = () => {
  if (!base.enabled || !preview) return Date.now();
  if (preview === 'before') return base.start - 3 * 864e5 - 5 * 36e5;
  if (preview === 'ended') return base.end + 36e5;
  return Date.now();
};
const contest = () => contestInfo(config, now());

// ── boot ───────────────────────────────────────────────────────
const { title } = applySiteText();
document.title = title;
puffTitle($('#title'), title);
initTheme($('#theme-toggle'));
initParallax($('#floaties'));
initStickyHeader($('#topbar'));
setupContest();
buildSpark($('#spark-spin'));
wireTicketTilt();
wireEasterEgg();
signWhenVisible($('#credit'));
document.addEventListener('sticker-share', shareSticker);

try {
  [cards] = await Promise.all([loadCards(config), stickerReady]);
  try { await tally.refresh(); } catch (err) { console.warn(err); toast('Likes are napping right now 😴'); }
  refreshAll();
} catch (err) {
  console.error(err);
}

if (likes.mode === 'shared') {
  setInterval(async () => {
    if (document.visibilityState !== 'visible') return;
    try { await tally.refresh(); refreshAll(); } catch { /* try again next time */ }
  }, 20000);
} else {
  const pill = $('#mode-pill');
  pill.hidden = false;
  pill.textContent = '💾 Likes and comments are in preview mode (saved in this browser only).';
}

function refreshAll() {
  updateStats();
  renderRace();
  renderLeader();
}

// ── stats ──────────────────────────────────────────────────────
function countUp(el, to) {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to; return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 900);
    el.textContent = Math.round(from + (to - from) * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function updateStats() {
  const real = cards.filter((c) => !c.demo);
  countUp($('#stat-stickers'), real.length || cards.length);
  countUp($('#stat-likes'), cards.reduce((sum, c) => sum + tally.count(c), 0));
  const newest = [...real].sort((a, b) => (b.added || '').localeCompare(a.added || ''))[0];
  $('#stat-newest').textContent = newest ? newest.name : (cards.length ? 'demo crew' : 'you?');
}

// ── 🏆 contest ─────────────────────────────────────────────────
function setupContest() {
  const info = contest();
  if (!info.enabled) return;
  $('#contest').hidden = false;
  $('#hero-contest').hidden = false;

  // "1 month of Claude" → big "1 month" + "of Claude"
  const m = /^(.+?)\s+of\s+(.+)$/i.exec(info.prize);
  $('#prize-word').textContent = info.prize;
  $('#ticket-big').textContent = m ? m[1] : info.prize;
  const of = $('#ticket-of');
  of.replaceChildren();
  if (m) {
    const name = Object.assign(document.createElement('b'), { textContent: m[2] });
    if (/claude/i.test(m[2])) name.insertAdjacentHTML('afterbegin', sparkSvg('currentColor', 'mini-spark'));
    of.append('of ', name);
  }
  $('#prize-detail').textContent = info.detail || `The sticker with the most likes when the contest ends wins ${info.prize}.`;

  const day = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  $('#contest-dates').textContent = `🏆 The Sticker Contest · ${day(info.start)} – ${day(info.end)}`;

  const rules = [
    ['❤️', 'Most likes wins.', 'One like per person on each sticker.'],
    ['🗓️', 'Likes count', `from ${fmtDate(info.start)} until ${fmtDate(info.end)}.`],
    ['🤝', 'A tie?', 'The sticker that reached its total first wins.'],
    ['🧩', 'Everyone can enter —', 'add your sticker with a pull request.'],
  ];
  $('#rules').replaceChildren(...rules.map(([icon, strong, rest]) => {
    const li = document.createElement('li');
    li.append(Object.assign(document.createElement('span'), { className: 'rule-icon', textContent: icon }),
      Object.assign(document.createElement('b'), { textContent: strong }), ` ${rest}`);
    return li;
  }));

  tickCountdown();
  setInterval(tickCountdown, 1000);
}

function tickCountdown() {
  const info = contest();
  if (!info.enabled) return;
  const zone = $('#contest');
  zone.dataset.phase = info.phase;
  $('#hero-contest-text').textContent = info.phase === 'ended'
    ? `The contest is over — see the winner`
    : `Win ${info.prize} · ${shortLeft(info, now())}`;

  const label = $('#cd-label');
  const when = $('#cd-when');
  const countdown = $('#countdown');
  $('#cta-vote').textContent = info.phase === 'running' ? '❤️ Vote on the wall' : '🔭 See the wall';
  if (info.phase === 'ended') {
    label.textContent = '🎉 The contest is over!';
    countdown.hidden = true;
    when.textContent = `Voting closed ${fmtDate(info.end)}.`;
  } else {
    countdown.hidden = false;
    label.textContent = info.phase === 'before' ? '⏳ Voting opens in' : '⏰ Voting ends in';
    when.textContent = info.phase === 'before' ? `Opens ${fmtDate(info.start)}` : `Ends ${fmtDate(info.end)}`;
    const t = timeLeft((info.phase === 'before' ? info.start : info.end) - now());
    for (const [k, v] of Object.entries(t)) flipTo($(`[data-cd="${k}"]`), String(v).padStart(2, '0'));
  }
  if (zone.dataset.lastPhase && zone.dataset.lastPhase !== info.phase) renderLeader();
  zone.dataset.lastPhase = info.phase;
}

/** Split-flap card: old top half falls, new bottom half lands, then everything settles. */
function flipTo(card, next) {
  if (!card) return;
  if (!card.firstChild) {
    for (const part of ['f-top', 'f-bottom', 'leaf-top', 'leaf-bottom']) {
      card.append(Object.assign(document.createElement('div'), { className: part }));
      card.lastChild.append(document.createElement('span'));
    }
  }
  const [top, bottom, leafTop, leafBottom] = [...card.children].map((d) => d.firstChild);
  const prev = card.dataset.value;
  if (prev === next) return;
  card.dataset.value = next;
  card.setAttribute('aria-label', next);
  if (prev == null || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const s of [top, bottom, leafTop, leafBottom]) s.textContent = next;
    return;
  }
  top.textContent = next;        // revealed behind the falling leaf
  bottom.textContent = prev;     // stays until the new half lands on it
  leafTop.textContent = prev;
  leafBottom.textContent = next;
  card.classList.remove('flipping');
  void card.offsetWidth;
  card.classList.add('flipping');
  clearTimeout(card.flipTimer);
  card.flipTimer = setTimeout(() => {
    bottom.textContent = next;
    card.classList.remove('flipping');
  }, 600);
}

function renderLeader() {
  const info = contest();
  if (!info.enabled) return;
  const ranked = rankCards(cards, tally.count, tally.last);
  const top = ranked[0];
  const ended = info.phase === 'ended';
  const key = `${info.phase}:${top?.id}:${top ? tally.count(top) : 0}`;
  if (key === leaderKey) return;
  leaderKey = key;

  // the ticket gets a WINNER stamp + the winner's name once it's over
  $('#ticket-stamp').hidden = !(ended && top);
  const winnerLine = $('#ticket-winner');
  winnerLine.hidden = !(ended && top);
  if (ended && top) {
    winnerLine.replaceChildren('Awarded to ', Object.assign(document.createElement('b'), { textContent: top.name, dir: 'auto' }));
  }

  const box = $('#leader');
  box.hidden = info.phase === 'before' || !top;
  box.classList.toggle('winner', ended);
  if (box.hidden) return;
  box.href = `wall.html#sticker-${top.id}`;
  const mini = document.createElement('sticker-card');
  mini.data = top;
  mini.setAttribute('noflip', '');
  mini.tabIndex = -1;
  const n = tally.count(top);
  const text = document.createElement('div');
  text.className = 'leader-text';
  text.append(
    Object.assign(document.createElement('small'), { textContent: ended ? '🏆 The winner is' : '👑 Leading right now' }),
    Object.assign(document.createElement('strong'), { textContent: top.name, dir: 'auto' }),
    Object.assign(document.createElement('span'), {
      textContent: `💖 ${n} ${n === 1 ? 'like' : 'likes'}${top.demo ? ' · demo preview' : ''}${ended ? '' : ' · tap to vote'}`,
    }),
  );
  box.replaceChildren(Object.assign(document.createElement('div'), { className: 'leader-sticker' }), text);
  box.firstChild.append(mini);

  // celebrate the winner once per visit
  if (ended && !sessionStorage.getItem('sw:winner-party')) {
    try { sessionStorage.setItem('sw:winner-party', '1'); } catch { /* fine */ }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      confetti({ count: 180 });
    }, { threshold: 0.4 });
    io.observe($('#contest'));
  }
}

/** The developer's signature writes itself in the first time the footer is seen. */
function signWhenVisible(el) {
  if (!el) return;
  if (!('IntersectionObserver' in window)) { el.classList.add('drawn'); return; }
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    el.classList.add('drawn');
  }, { threshold: 0.6 });
  io.observe(el);
}

// ── ✳ the spinning 3D Claude-style spark ──────────────────────
function sparkSvg(stroke, cls = '') {
  const lines = RAYS.map((len, i) => {
    const a = (i / RAYS.length) * Math.PI * 2 - Math.PI / 2 + (i % 2 ? 0.07 : -0.04);
    const p = (r) => `${(50 + Math.cos(a) * r).toFixed(1)}`;
    const q = (r) => `${(50 + Math.sin(a) * r).toFixed(1)}`;
    return `<line x1="${p(4)}" y1="${q(4)}" x2="${p(len)}" y2="${q(len)}"/>`;
  }).join('');
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="${stroke}" stroke-width="9.5" stroke-linecap="round">${lines}</g></svg>`;
}

/**
 * Stack copies of the spark along Z so it has real thickness. The layers sit
 * well under 1px apart, so they merge into one solid piece; and the spark spins
 * in its own plane while tilting gently, so it never turns edge-on.
 */
function buildSpark(el) {
  if (!el) return;
  const layers = 18;
  const depth = 9; // px of thickness
  let html = `<svg width="0" height="0" style="position:absolute"><defs>
    <linearGradient id="spark-face" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7a582"/><stop offset=".45" stop-color="#e07a57"/><stop offset="1" stop-color="#c85d3a"/>
    </linearGradient></defs></svg>`;
  for (let i = 0; i < layers; i++) {
    const z = (i / (layers - 1) - 0.5) * depth;
    const face = i === 0 || i === layers - 1;
    const stroke = face ? 'url(#spark-face)' : 'hsl(15 52% 40%)'; // one even edge colour = no visible banding
    html += sparkSvg(stroke, face ? 'face' : '').replace('<svg ', `<svg style="transform: translateZ(${z.toFixed(2)}px)" `);
  }
  el.innerHTML = `<div class="spark-rot">${html}</div>`;
}

/** The 3D prize ticket tilts toward your mouse. */
function wireTicketTilt() {
  const scene = $('#ticket');
  if (!scene || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let raf = 0;
  scene.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = scene.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      scene.classList.add('hover');
      scene.style.setProperty('--rx', `${((0.5 - y) * 16).toFixed(2)}deg`);
      scene.style.setProperty('--ry', `${((x - 0.5) * 22).toFixed(2)}deg`);
      scene.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      scene.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    });
  });
  scene.addEventListener('pointerleave', () => {
    cancelAnimationFrame(raf);
    scene.classList.remove('hover');
    for (const p of ['--rx', '--ry', '--mx', '--my']) scene.style.removeProperty(p);
  });
}

// ── 🏁 the race (top 3 podium) ─────────────────────────────────
function renderRace() {
  const info = contest();
  const top = rankCards(cards, tally.count, tally.last).slice(0, 3);
  const key = top.map((c) => `${c.id}:${tally.count(c)}`).join('|') + info.phase;
  if (key === podiumKey) return;
  podiumKey = key;
  $('#fame').hidden = top.length === 0;
  $('#fame-title').textContent = info.enabled && info.phase === 'ended' ? '🏁 Final results' : '🏁 The race so far';
  $('#fame-sub').textContent = info.enabled && info.phase === 'ended'
    ? 'Thank you for every sticker, like and comment 💖'
    : 'The top 3 right now — every like counts.';

  const podium = $('#podium');
  podium.replaceChildren();
  for (const i of [1, 0, 2].filter((k) => top[k])) {
    const card = top[i];
    const place = document.createElement('div');
    place.className = `place p${i + 1}`;
    if (i === 0) place.append(Object.assign(document.createElement('span'), { className: 'crown', textContent: '👑' }));
    const sticker = document.createElement('sticker-card');
    sticker.data = { ...card, tilt: [0, -4, 5][i] };
    sticker.style.setProperty('--tilt', `${[0, -4, 5][i]}deg`);
    const pedestal = document.createElement('div');
    pedestal.className = 'pedestal';
    pedestal.append(Object.assign(document.createElement('span'), { className: 'rank', textContent: i + 1 }));
    const count = Object.assign(document.createElement('a'), {
      className: 'count',
      href: `wall.html#sticker-${card.id}`,
      textContent: `💖 ${tally.count(card)}`,
      title: `See ${card.name} on the wall`,
    });
    place.append(sticker, pedestal, count);
    podium.append(place);
  }
}

async function shareSticker(e) {
  const url = new URL(`wall.html#sticker-${e.detail.id}`, location.href).href;
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied — go share the love 💌');
  } catch {
    toast(url, 6000);
  }
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
  });
}
