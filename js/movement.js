// movement.js — MovementSystem
// Handles free player movement and arena clamping.
// Only runs when player.state === 'idle' — attack dashes belong to CombatSystem.
// ── Writes: World.player (x, y, facing)
// ── Reads:  World.input, World.player (state, speed, r), World.ARENA
// ── Emits:  nothing
// ── Listens: nothing
const MovementSystem = (() => {
  function update(dt) {
    const p      = World.player;
    const inp    = World.input;
    const { ARENA } = World;
    const { clamp } = Utils;

    if (p.state !== 'idle') return;

    p.x += inp.mx * p.speed * dt;
    p.y += inp.my * p.speed * dt;

    if (inp.mx !== 0 || inp.my !== 0) {
      p.facing = Math.atan2(inp.my, inp.mx);
    }

    p.x = clamp(p.x, ARENA.x + p.r, ARENA.x + ARENA.w - p.r);
    p.y = clamp(p.y, ARENA.y + p.r, ARENA.y + ARENA.h - p.r);
  }

  return { update };
})();
