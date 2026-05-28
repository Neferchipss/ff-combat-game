// utils.js — Pure math and color helpers. No state, no World access, no side-effects.
const Utils = (() => {
  const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dist    = (a, b)      => Math.hypot(a.x - b.x, a.y - b.y);
  const easeOut = t           => 1 - (1 - t) ** 3;
  const lerp    = (a, b, t)   => a + (b - a) * t;
  const rand    = (lo, hi)    => lo + Math.random() * (hi - lo);

  function comboColor(n) {
    if (n < 3)  return '#ffffff';
    if (n < 6)  return '#ffe066';
    if (n < 12) return '#ff9900';
    return '#ff4444';
  }

  return { clamp, dist, easeOut, lerp, rand, comboColor };
})();
