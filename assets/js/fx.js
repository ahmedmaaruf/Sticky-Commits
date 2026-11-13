// Little bursts of joy: heart particles + confetti rain.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let layer;
function getLayer() {
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
  }
  return layer;
}
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Pop a burst of emoji particles from a point on screen. */
export function burst(x, y, { emojis = ['💖', '💗', '✨', '💕', '⭐'], count = 14, spread = 90 } = {}) {
  if (reduced.matches) return;
  const root = getLayer();
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'particle';
    el.textContent = pick(emojis);
    el.style.fontSize = `${rand(12, 24)}px`;
    root.append(el);
    const a = rand(0, Math.PI * 2);
    const d = rand(spread * 0.45, spread);
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d - 35;
    const spin = rand(-90, 90);
    el.animate([
      { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(.2)`, opacity: 1 },
      { transform: `translate(${x + dx}px, ${y + dy}px) translate(-50%, -50%) scale(1.1) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${x + dx * 1.2}px, ${y + dy + 60}px) translate(-50%, -50%) scale(.5) rotate(${spin}deg)`, opacity: 0 },
    ], { duration: rand(750, 1150), easing: 'cubic-bezier(.15,.7,.3,1)' }).onfinish = () => el.remove();
  }
}

/** Confetti rain over the whole screen. */
export function confetti({ count = 140, colors = ['#ff6fae', '#ffd166', '#5fd9b4', '#74c7ff', '#a98bff', '#ffa98a'] } = {}) {
  if (reduced.matches) return;
  const root = getLayer();
  const W = innerWidth;
  const H = innerHeight;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('i');
    el.className = 'confetti';
    const w = rand(6, 12);
    el.style.width = `${w}px`;
    el.style.height = `${w * rand(0.4, 1.6)}px`;
    el.style.background = pick(colors);
    if (Math.random() < 0.3) el.style.borderRadius = '50%';
    root.append(el);
    const x = rand(0, W);
    const drift = rand(-160, 160);
    el.animate([
      { transform: `translate(${x}px, -30px) rotate(0deg) rotateY(0deg)` },
      { transform: `translate(${x + drift}px, ${H + 40}px) rotate(${rand(-720, 720)}deg) rotateY(${rand(360, 1080)}deg)` },
    ], { duration: rand(1800, 3600), delay: rand(0, 700), easing: 'cubic-bezier(.25,.4,.5,1)', fill: 'backwards' })
      .onfinish = () => el.remove();
  }
}
