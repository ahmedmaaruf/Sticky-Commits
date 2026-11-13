// ═══════════════════════════════════════════════════════════════
//  The sticker contest: dates, phases and the ranking rules.
// ═══════════════════════════════════════════════════════════════

/** Where the contest is right now: 'before' | 'running' | 'ended' (or disabled). */
export function contestInfo(config, now = Date.now()) {
  const c = config.contest || {};
  const start = Date.parse(c.start);
  const end = Date.parse(c.end);
  if (!c.enabled || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { enabled: false, votingOpen: true };
  }
  const phase = now < start ? 'before' : now > end ? 'ended' : 'running';
  return {
    enabled: true,
    start,
    end,
    phase,
    votingOpen: phase === 'running',
    prize: c.prize || 'a prize',
    detail: c.prizeDetail || '',
  };
}

/**
 * Contest ranking: most likes wins; on a tie, whoever reached their total first.
 * Demo stickers only stand in until real stickers exist.
 */
export function rankCards(cards, countOf, lastOf) {
  const real = cards.filter((c) => !c.demo);
  const pool = real.length ? real : cards;
  return pool
    .filter((c) => countOf(c) > 0)
    .sort((a, b) => countOf(b) - countOf(a)
      || (lastOf(a) ?? Infinity) - (lastOf(b) ?? Infinity)
      || a.name.localeCompare(b.name));
}

export function timeLeft(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor(s / 3600) % 24, mins: Math.floor(s / 60) % 60, secs: s % 60 };
}

export const fmtDate = (ms) => new Date(ms).toLocaleString(undefined, {
  weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

/** Short "12d 4h left" style label for chips. */
export function shortLeft(info, now = Date.now()) {
  if (!info.enabled) return '';
  if (info.phase === 'ended') return 'Contest closed';
  const t = timeLeft((info.phase === 'before' ? info.start : info.end) - now);
  const span = t.days ? `${t.days}d ${t.hours}h` : t.hours ? `${t.hours}h ${t.mins}m` : `${t.mins}m ${t.secs}s`;
  return info.phase === 'before' ? `Starts in ${span}` : `${span} left`;
}
