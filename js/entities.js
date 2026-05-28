// entities.js — EntitySystem
// Factory functions and wave spawner. Pure data — no update logic here.
// Tune values via PLAYER_DEFAULTS / ENEMY_DEFAULTS or pass cfg overrides to each factory.
// ── Writes: World.player (init), World.enemies (spawnWave)
// ── Reads:  World.W, World.H, World.ARENA
// ── Emits:  nothing
// ── Listens: nothing
const EntitySystem = (() => {
  // ── Tuneable defaults ─────────────────────────────────────────────────────
  const PLAYER_DEFAULTS = {
    r:                16,
    hp:                5,
    speed:           230,
    attackDur:      0.17,
    counterDur:     0.20,
    finisherDur:    0.45,
    chainWindow:     1.8,
    finisherThreshold: 8,
    // Attack range: max center-to-center distance for a snap-to-enemy dash.
    // Beyond this, the player lunges missLunge px in the enemy's direction but doesn't reach.
    attackRange:     200,
    missLunge:        65,
    meleeRange:       80,  // reach for stationary attacks (combo < 3)
  };

  const ENEMY_DEFAULTS = {
    r:              15,
    hp:              7,
    speed:          75,
    windupDur:    0.65,
    cooldownDur:   1.1,
    orbitSpeedMin: 0.45,   // rad/s — how fast they strafe around the player
    orbitSpeedMax: 0.85,
    feintChance:      0.18,  // per-second probability of cancelling a windup mid-telegraph
    orbitFlipChance:  0.003, // per-frame probability of reversing orbit direction
    orbitFlipCooldown: 2.0,  // min seconds between direction flips
  };

  // ── Factories ─────────────────────────────────────────────────────────────
  function makePlayer(x, y, cfg = {}) {
    const c = { ...PLAYER_DEFAULTS, ...cfg };
    return {
      x, y, r: c.r,
      hp: c.hp, maxHp: c.hp,
      speed:             c.speed,
      attackDur:         c.attackDur,
      counterDur:        c.counterDur,
      finisherDur:       c.finisherDur,
      chainWindow:       c.chainWindow,
      finisherThreshold: c.finisherThreshold,
      attackRange:       c.attackRange,
      missLunge:         c.missLunge,
      meleeRange:        c.meleeRange,
      // state
      state: 'idle',   // idle | attacking | countering | finishing | hurt | dead
      stateTimer: 0,
      fromX: x, fromY: y,
      toX: x,   toY: y,
      target: null,
      combo: 0, comboTimer: 0,
      facing: 0,
      iframes: 0,
    };
  }

  function makeEnemy(x, y, cfg = {}) {
    const c = { ...ENEMY_DEFAULTS, ...cfg };
    return {
      x, y, r: c.r,
      hp: c.hp, maxHp: c.hp,
      speed:       c.speed       + Utils.rand(-25, 25),
      windupDur:   c.windupDur   + Utils.rand(-0.22, 0.22),
      cooldownDur: c.cooldownDur + Utils.rand(-0.4,  0.4),
      // orbit properties
      orbitAngle: Utils.rand(0, Math.PI * 2),
      orbitDir:   Math.random() > 0.5 ? 1 : -1,
      orbitSpeed: Utils.rand(c.orbitSpeedMin, c.orbitSpeedMax),
      feintChance:      c.feintChance,
      orbitFlipChance:  c.orbitFlipChance,
      orbitFlipCooldown: 0,  // runtime counter; starts ready to flip
      // state
      state: 'approach',  // approach | orbit | windup | attacking | cooldown | stunned | knockback | dead
      stateTimer: 0,
      decideTimer: Utils.rand(1.0, 2.5),
      vx: 0, vy: 0,
      hitFlash: 0,
      facing: 0,
    };
  }

  // ── Spawn helpers ─────────────────────────────────────────────────────────
  function spawnWave(count, enemyCfg = {}) {
    const { W, H, ARENA } = World;
    World.enemies = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.2;
      const d = Utils.rand(190, 260);
      World.enemies.push(makeEnemy(
        Utils.clamp(W/2 + Math.cos(a) * d, ARENA.x + 20, ARENA.x + ARENA.w - 20),
        Utils.clamp(H/2 + Math.sin(a) * d, ARENA.y + 20, ARENA.y + ARENA.h - 20),
        enemyCfg
      ));
    }
  }

  function init(playerCfg = {}) {
    World.player = makePlayer(World.W / 2, World.H / 2, playerCfg);
  }

  return { init, makePlayer, makeEnemy, spawnWave, PLAYER_DEFAULTS, ENEMY_DEFAULTS };
})();
