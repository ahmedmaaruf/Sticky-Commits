// ═══════════════════════════════════════════════════════════════
//  An infinite cutting mat you can drag, zoom, pinch and fly around.
//  screen = world × scale + (tx, ty)
// ═══════════════════════════════════════════════════════════════
const MIN_SCALE = 0.18;
const MAX_SCALE = 2.6;
const RULER = 24; // px thickness of the rulers
const UNIT = 120; // world px per ruler number ("1 cm")
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const roundRect = (ctx, x, y, w, h, r) => (ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h));

export function createCamera(viewport, world, { rulerX, rulerY, minimap, zoomLabel, onHint } = {}) {
  let s = 1;
  let tx = 0;
  let ty = 0;
  let bounds = { x0: -400, y0: -300, x1: 400, y1: 300 };
  let dots = [];
  let anim = 0;
  let drawQueued = 0;
  let exploring = false;
  let mmMap = null;

  const vw = () => viewport.clientWidth;
  const vh = () => viewport.clientHeight;
  const clampS = (v) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));
  const center = () => ({ x: (vw() / 2 - tx) / s, y: (vh() / 2 - ty) / s });

  // ── core ───────────────────────────────────────────────────
  function apply() {
    s = clampS(s);
    // never let the stickers drift completely out of view
    const m = 260;
    const c = center();
    const cx = Math.min(bounds.x1 + m, Math.max(bounds.x0 - m, c.x));
    const cy = Math.min(bounds.y1 + m, Math.max(bounds.y0 - m, c.y));
    tx = vw() / 2 - cx * s;
    ty = vh() / 2 - cy * s;

    world.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s.toFixed(4)})`;
    const st = viewport.style;
    st.setProperty('--gx', `${tx.toFixed(1)}px`);
    st.setProperty('--gy', `${ty.toFixed(1)}px`);
    st.setProperty('--g1', `${(24 * s).toFixed(2)}px`);
    st.setProperty('--g2', `${(120 * s).toFixed(2)}px`);
    st.setProperty('--ma', Math.min(1, Math.max(0, (24 * s - 5) / 9)).toFixed(2));
    if (zoomLabel) zoomLabel.textContent = `${Math.round(s * 100)}%`;
    drawQueued ||= requestAnimationFrame(() => { drawQueued = 0; drawRulers(); drawMinimap(); });
  }

  function stop() {
    if (anim) cancelAnimationFrame(anim);
    anim = 0;
  }

  function zoomAt(factor, px, py) {
    const ns = clampS(s * factor);
    tx = px - ((px - tx) * ns) / s;
    ty = py - ((py - ty) * ns) / s;
    s = ns;
    apply();
  }

  /** Smoothly fly to a world point at a given zoom (zooms out a little on long trips). */
  function flyTo(wx, wy, targetScale = s, duration = 950) {
    stop();
    const ts = clampS(targetScale);
    const s0 = s;
    const c0 = center();
    if (reduced.matches || duration <= 0) {
      s = ts;
      tx = vw() / 2 - wx * s;
      ty = vh() / 2 - wy * s;
      apply();
      return Promise.resolve();
    }
    const trip = Math.hypot(wx - c0.x, wy - c0.y) * Math.min(s0, ts);
    const dip = Math.min(0.55, trip / (Math.max(vw(), vh()) * 2.2));
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    const t0 = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        const e = ease(t);
        const cx = c0.x + (wx - c0.x) * e;
        const cy = c0.y + (wy - c0.y) * e;
        s = Math.exp(Math.log(s0) + (Math.log(ts) - Math.log(s0)) * e) * (1 - dip * Math.sin(Math.PI * t));
        tx = vw() / 2 - cx * s;
        ty = vh() / 2 - cy * s;
        apply();
        if (t < 1) anim = requestAnimationFrame(step);
        else { anim = 0; resolve(); }
      };
      anim = requestAnimationFrame(step);
    });
  }

  /** Frame a box (defaults to all stickers). */
  function fit(box = bounds, { animate = true, max = 1, min = MIN_SCALE } = {}) {
    const padX = 80;
    const padTop = 110; // room for the toolbar floating on top
    const padBottom = 80;
    const bw = Math.max(1, box.x1 - box.x0);
    const bh = Math.max(1, box.y1 - box.y0);
    const ts = clampS(Math.max(min, Math.min((vw() - padX * 2) / bw, (vh() - padTop - padBottom) / bh, max)));
    // shift the centre so the box sits in the free area below the toolbar
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2 - (padTop - padBottom) / 2 / ts;
    return flyTo(cx, cy, ts, animate ? 900 : 0);
  }

  function zoomBy(factor) {
    const c = center();
    return flyTo(c.x, c.y, s * factor, 380);
  }

  // ── rulers ─────────────────────────────────────────────────
  function prepCanvas(cv) {
    const dpr = devicePixelRatio || 1;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (!w || !h) return null;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function drawRulers() {
    let minor = 24;
    while (minor * s < 7) minor *= 5;
    for (const [cv, horiz] of [[rulerX, true], [rulerY, false]]) {
      if (!cv) continue;
      const c = prepCanvas(cv);
      if (!c) continue;
      const { ctx, w, h } = c;
      const ink = getComputedStyle(cv).color;
      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      ctx.lineWidth = 1;
      ctx.font = '700 9px "Space Mono", ui-monospace, monospace';
      const t = horiz ? tx : ty;
      const len = horiz ? w : h;
      const start = Math.floor((RULER - t) / s / minor) * minor;
      const end = (len + RULER - t) / s;
      ctx.beginPath();
      for (let v = start; v <= end; v += minor) {
        const p = Math.round(v * s + t - RULER) + 0.5;
        const major = Math.round(v / minor) % 5 === 0;
        const tick = major ? 11 : 5;
        if (horiz) { ctx.moveTo(p, h); ctx.lineTo(p, h - tick); } else { ctx.moveTo(w, p); ctx.lineTo(w - tick, p); }
        if (major) {
          const label = String(Math.round(v / UNIT));
          if (horiz) ctx.fillText(label, p + 3, 10);
          else {
            ctx.save();
            ctx.translate(10, p - 3);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(label, 0, 0);
            ctx.restore();
          }
        }
      }
      ctx.stroke();
    }
  }

  // ── minimap ────────────────────────────────────────────────
  function drawMinimap() {
    if (!minimap) return;
    const c = prepCanvas(minimap);
    if (!c) return;
    const { ctx, w, h } = c;
    const pad = 10;
    const m = 160;
    const b = { x0: bounds.x0 - m, y0: bounds.y0 - m, x1: bounds.x1 + m, y1: bounds.y1 + m };
    const k = Math.min((w - pad * 2) / (b.x1 - b.x0), (h - pad * 2) / (b.y1 - b.y0));
    const ox = (w - (b.x1 - b.x0) * k) / 2 - b.x0 * k;
    const oy = (h - (b.y1 - b.y0) * k) / 2 - b.y0 * k;
    mmMap = { k, ox, oy };

    const cw = Math.max(4, 220 * k);
    const ch = Math.max(5, 293 * k);
    for (const d of dots) {
      ctx.globalAlpha = d.dim ? 0.18 : 0.95;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      roundRect(ctx, d.x * k + ox - cw / 2, d.y * k + oy - ch / 2, cw, ch, Math.min(3, cw / 3));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // the part you're looking at
    const rx = (0 - tx) / s * k + ox;
    const ry = (0 - ty) / s * k + oy;
    const rw = (vw() / s) * k;
    const rh = (vh() / s) * k;
    ctx.fillStyle = 'rgba(255, 111, 174, .14)';
    ctx.strokeStyle = '#ff6fae';
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundRect(ctx, rx, ry, rw, rh, 4);
    ctx.fill();
    ctx.stroke();
  }

  if (minimap) {
    const jump = (e, animate) => {
      if (!mmMap) return;
      const r = minimap.getBoundingClientRect();
      const wx = (e.clientX - r.left - mmMap.ox) / mmMap.k;
      const wy = (e.clientY - r.top - mmMap.oy) / mmMap.k;
      if (animate) flyTo(wx, wy, s, 500);
      else { stop(); tx = vw() / 2 - wx * s; ty = vh() / 2 - wy * s; apply(); }
    };
    let mmDrag = false;
    minimap.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      mmDrag = true;
      minimap.setPointerCapture(e.pointerId);
      jump(e, true);
    });
    minimap.addEventListener('pointermove', (e) => { if (mmDrag && e.buttons) jump(e, false); });
    minimap.addEventListener('pointerup', () => { mmDrag = false; });
  }

  // ── dragging & pinching ────────────────────────────────────
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  let suppressClick = false;
  const isUi = (el) => el.closest?.('.cam-controls, .minimap, .canvas-msg');

  viewport.addEventListener('pointerdown', (e) => {
    if (isUi(e.target) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    stop();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      drag = { x: e.clientX, y: e.clientY, tx, ty, moved: false };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const r = viewport.getBoundingClientRect();
      pinch = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: (a.x + b.x) / 2 - r.left,
        my: (a.y + b.y) / 2 - r.top,
        s, tx, ty,
      };
      if (drag) drag.moved = true;
    }
  });

  addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const r = viewport.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - r.left;
      const my = (a.y + b.y) / 2 - r.top;
      const ns = clampS(pinch.s * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist));
      const wx = (pinch.mx - pinch.tx) / pinch.s;
      const wy = (pinch.my - pinch.ty) / pinch.s;
      s = ns;
      tx = mx - wx * ns;
      ty = my - wy * ns;
      apply();
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 5) {
      drag.moved = true;
      viewport.classList.add('dragging');
      try { viewport.setPointerCapture(e.pointerId); } catch { /* already released */ }
    }
    if (drag.moved) {
      tx = drag.tx + dx;
      ty = drag.ty + dy;
      apply();
    }
  });

  const release = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 1) {
      const [p] = [...pointers.values()];
      drag = { x: p.x, y: p.y, tx, ty, moved: true };
    } else if (pointers.size === 0) {
      if (drag?.moved && e.type === 'pointerup') {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 0);
      }
      drag = null;
      viewport.classList.remove('dragging');
    }
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);

  // a drag shouldn't count as a click on whatever sticker it ended on
  viewport.addEventListener('click', (e) => {
    if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; }
  }, true);

  viewport.addEventListener('dblclick', (e) => {
    if (isUi(e.target) || e.target.closest('.slot')) return;
    const r = viewport.getBoundingClientRect();
    const wx = (e.clientX - r.left - tx) / s;
    const wy = (e.clientY - r.top - ty) / s;
    flyTo(wx, wy, s * 1.8, 450);
  });

  // ── wheel ──────────────────────────────────────────────────
  viewport.addEventListener('wheel', (e) => {
    const zoomGesture = e.ctrlKey || e.metaKey;
    if (!exploring && !zoomGesture) { onHint?.(); return; } // let the page scroll
    e.preventDefault();
    stop();
    const lineMode = e.deltaMode !== 0;
    const mouseWheel = lineMode || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY));
    const mul = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? vh() : 1;
    const dx = e.deltaX * mul;
    const dy = e.deltaY * mul;
    const r = viewport.getBoundingClientRect();
    if (zoomGesture || mouseWheel) {
      const k = zoomGesture && !lineMode && Math.abs(dy) < 40 ? 0.012 : 0.0022; // trackpad pinch vs wheel
      zoomAt(Math.exp(-dy * k), e.clientX - r.left, e.clientY - r.top);
    } else {
      tx -= dx;
      ty -= dy;
      apply();
    }
  }, { passive: false });

  // ── keyboard ───────────────────────────────────────────────
  viewport.addEventListener('keydown', (e) => {
    if (e.target !== viewport) return;
    const step = 120;
    const map = {
      ArrowLeft: () => { tx += step; apply(); },
      ArrowRight: () => { tx -= step; apply(); },
      ArrowUp: () => { ty += step; apply(); },
      ArrowDown: () => { ty -= step; apply(); },
      '+': () => zoomBy(1.4),
      '=': () => zoomBy(1.4),
      '-': () => zoomBy(1 / 1.4),
      _: () => zoomBy(1 / 1.4),
      0: () => fit(),
    };
    if (map[e.key]) { e.preventDefault(); stop(); map[e.key](); }
  });

  // keep the same spot centred when the board changes size
  let last = { w: vw(), h: vh() };
  new ResizeObserver(() => {
    const w = vw();
    const h = vh();
    if (!w || !h) return;
    const cx = (last.w / 2 - tx) / s;
    const cy = (last.h / 2 - ty) / s;
    tx = w / 2 - cx * s;
    ty = h / 2 - cy * s;
    last = { w, h };
    apply();
  }).observe(viewport);

  return {
    apply,
    fit,
    flyTo,
    zoomBy,
    zoomTo: (v) => { const c = center(); return flyTo(c.x, c.y, v, 380); },
    get scale() { return s; },
    setBounds(b) { bounds = b; apply(); },
    setDots(d) { dots = d; drawQueued ||= requestAnimationFrame(() => { drawQueued = 0; drawRulers(); drawMinimap(); }); },
    setExploring(v) { exploring = v; },
    redraw() { drawRulers(); drawMinimap(); },
  };
}
