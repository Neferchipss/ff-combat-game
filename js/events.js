// events.js — Lightweight pub/sub event bus
// Systems emit when notable things happen; others listen if they care.
// No system imports another system — this bus is the only cross-system channel.
//
// Event catalog:
//   'hit'                  { enemy, combo }  — player attack landed
//   'counter'              { enemy, combo }  — player counter landed
//   'player:hurt'          { hp }            — player took damage
//   'player:dead'          {}                — player died
//   'enemy:dead'           { enemy }         — an enemy was killed
//   'combo:break'          {}                — combo reset by taking a hit
//   'combo:end'            {}                — combo timed out naturally
//   'enemy:attack:connect' { enemy }         — enemy reached player (AISystem → CombatSystem)
const GameEvents = (() => {
  const _bus = Object.create(null);

  function on(type, fn)  { (_bus[type] ??= []).push(fn); }
  function off(type, fn) { if (_bus[type]) _bus[type] = _bus[type].filter(f => f !== fn); }
  function emit(type, payload) { (_bus[type] || []).slice().forEach(fn => fn(payload)); }
  function clear() { for (const k in _bus) delete _bus[k]; }

  return { on, off, emit, clear };
})();
