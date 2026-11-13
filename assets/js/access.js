// ═══════════════════════════════════════════════════════════════
//  🎟️ Access codes — the little paper code that opens the website.
//
//  No accounts and no names: you type your 6-digit code once and this
//  device remembers it for good. Likes and comments are sent with the
//  code, and the database checks it every time (supabase/setup.sql).
//
//  • On the real website the page stays hidden until a code is entered.
//  • On your own computer (localhost) you can look around freely, and
//    the code screen only pops up when you like or comment.
//  • In preview mode (Supabase not set up) there are no codes at all.
// ═══════════════════════════════════════════════════════════════
import { store, supabase } from './supabase.js';
import { confetti } from './fx.js';

const KEY = 'sw:code';
const isLocalHost = () => ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);
const VALID = /^[0-9]{6}$/;

export function createAccess(config = {}) {
  const db = supabase(config);
  let code = db ? store.get(KEY, null) : null;
  if (!VALID.test(code || '')) code = null;
  let showing = null; // the open screen's promise

  const save = (value) => {
    code = value;
    store.set(KEY, value);
  };
  const unlockPage = () => document.documentElement.classList.remove('gated');

  async function check(value) {
    const ok = await db.rpc('check_code', { p_code: value });
    if (ok === true) save(value);
    return ok === true;
  }

  function show({ dismissible }) {
    if (showing) return showing;
    showing = new Promise((resolve) => openScreen({ dismissible, check, done: resolve }));
    showing.finally(() => { showing = null; });
    return showing;
  }

  return {
    enabled: !!db,
    code: () => code,
    has: () => !!code,
    /** The code stopped working (e.g. it was removed): forget it on this device. */
    forget() {
      code = null;
      store.set(KEY, null);
    },
    /** Ask for a code now (before liking or commenting). Resolves true once a good code is saved. */
    ask() {
      if (!db || code) return Promise.resolve(!!code);
      return show({ dismissible: isLocalHost() });
    },
    /** Page load: on the real website nothing shows until a code is entered. */
    async gate() {
      if (!db || code || isLocalHost()) { unlockPage(); return; }
      await show({ dismissible: false });
    },
  };
}

// ── the code screen ────────────────────────────────────────────
function openScreen({ dismissible, check, done }) {
  // A real <dialog>, so it also sits on top of other open dialogs (e.g. comments).
  const root = document.createElement('dialog');
  root.className = `gate${dismissible ? ' modal' : ''}`;
  root.setAttribute('aria-labelledby', 'gate-title');
  root.innerHTML = `
    <div class="gate-floaties" aria-hidden="true">
      <span class="emoji-sticker" style="--s:46px;left:9%;top:14%">⭐</span>
      <span class="emoji-sticker" style="--s:40px;right:11%;top:18%">🍓</span>
      <span class="emoji-sticker" style="--s:50px;left:13%;bottom:16%">🚀</span>
      <span class="emoji-sticker" style="--s:42px;right:9%;bottom:20%">💖</span>
    </div>
    <form class="gate-card" novalidate>
      <span class="gate-tape" aria-hidden="true"></span>
      <div class="gate-icon" aria-hidden="true">🎟️</div>
      <h1 class="gate-title" id="gate-title">Enter your code</h1>
      <p class="gate-sub">Type the 6-digit code from your paper</p>
      <div class="gate-digits" role="group" aria-label="Your 6-digit code">
        ${[1, 2, 3, 4, 5, 6].map((n) => `<input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="${n === 1 ? 'one-time-code' : 'off'}" aria-label="Digit ${n} of 6">`).join('')}
      </div>
      <p class="gate-msg" role="alert"></p>
      <button class="btn gate-go" type="submit">Let me in ✨</button>
      ${dismissible ? '<button class="gate-later" type="button">Not now</button>' : ''}
      <p class="gate-note">You only need to do this once on each device.</p>
    </form>`;

  const form = root.querySelector('form');
  const boxes = [...root.querySelectorAll('.gate-digits input')];
  const msg = root.querySelector('.gate-msg');
  const go = root.querySelector('.gate-go');
  const value = () => boxes.map((b) => b.value).join('');
  let busy = false;

  document.body.append(root);
  root.showModal(); // the rest of the page can't be reached while it's open
  requestAnimationFrame(() => boxes[0].focus());

  const close = (ok) => {
    if (ok) {
      document.documentElement.classList.remove('gated');
      root.classList.add('done');
      confetti({ count: 90 });
      setTimeout(() => { root.close(); root.remove(); }, 700);
    } else {
      root.close();
      root.remove();
    }
    done(ok);
  };
  // Escape only closes it when looking around without a code is allowed
  root.addEventListener('cancel', (e) => {
    e.preventDefault();
    if (dismissible) close(false);
  });
  root.querySelector('.gate-later')?.addEventListener('click', () => close(false));

  // typing, pasting and deleting across the six boxes
  const fill = (start, digits) => {
    let i = start;
    for (const d of digits) {
      if (i > 5) break;
      boxes[i].value = d;
      i += 1;
    }
    boxes[Math.min(i, 5)].focus();
    if (value().length === 6) submit();
  };
  boxes.forEach((box, i) => {
    box.addEventListener('focus', () => box.select());
    box.addEventListener('input', () => {
      const digits = box.value.replace(/\D/g, '');
      box.value = '';
      msg.textContent = '';
      if (digits) fill(i, digits);
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        e.preventDefault();
        boxes[i - 1].value = '';
        boxes[i - 1].focus();
      } else if (e.key === 'ArrowLeft' && i > 0) {
        e.preventDefault();
        boxes[i - 1].focus();
      } else if (e.key === 'ArrowRight' && i < 5) {
        e.preventDefault();
        boxes[i + 1].focus();
      }
    });
    box.addEventListener('paste', (e) => {
      const digits = (e.clipboardData?.getData('text') || '').replace(/\D/g, '');
      if (!digits) return;
      e.preventDefault();
      boxes.forEach((b) => { b.value = ''; });
      fill(0, digits);
    });
  });

  async function submit(e) {
    e?.preventDefault();
    if (busy) return;
    const v = value();
    if (v.length < 6) {
      msg.textContent = 'Type all 6 digits 🙂';
      boxes[v.length]?.focus();
      return;
    }
    busy = true;
    go.disabled = true;
    go.textContent = 'Checking…';
    try {
      if (await check(v)) { close(true); return; }
      msg.textContent = 'Hmm, that code doesn’t work. Check your paper and try again.';
      root.classList.remove('shake');
      void root.offsetWidth;
      root.classList.add('shake');
      boxes.forEach((b) => { b.value = ''; });
      boxes[0].focus();
    } catch (err) {
      msg.textContent = /too many/i.test(err.message)
        ? 'Too many wrong codes from this network. Wait a few minutes, then try again.'
        : 'Couldn’t check your code. Check your internet and try again.';
    } finally {
      busy = false;
      go.disabled = false;
      go.textContent = 'Let me in ✨';
    }
  }
  form.addEventListener('submit', submit);
}
