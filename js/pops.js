// pops.js — PopSystem
// Advances floating text positions and culls expired entries each frame.
// ── Writes: World.pops (mutates y, life; replaces array without dead entries)
// ── Reads:  World.pops
// ── Emits:  nothing
// ── Listens: nothing
const PopSystem = (() => {
  function update(dt) {
    for (const p of World.pops) {
      p.y    += p.vy * dt;
      p.life -= dt;
    }
    World.pops = World.pops.filter(p => p.life > 0);
  }

  return { update };
})();
