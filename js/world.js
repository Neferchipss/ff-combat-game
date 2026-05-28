// world.js — Shared blackboard: config constants + mutable state
// Systems read/write their own slice here. Nothing else is shared between systems.
const World = {
  // Set once by game.js on boot
  canvas: null,
  ctx:    null,
  W: 960, H: 640,
  ARENA: { x: 80, y: 80, w: 800, h: 480 },
  TILE:  60,

  // Written by: InputSystem
  // Read by:    MovementSystem, CombatSystem
  // aimX/aimY: right-stick direction (gamepad) or movement direction (keyboard).
  // Used by CombatSystem to pick the enemy closest to the aimed direction.
  input: { mx: 0, my: 0, attackDown: false, counterDown: false, counterHeld: false, finisherDown: false, aimX: 0, aimY: 0 },

  // Written by: EntitySystem (init/spawn), MovementSystem + CombatSystem (per frame)
  // Read by:    CombatSystem, AISystem, RenderSystem, HUDSystem
  player: null,

  // Written by: EntitySystem (spawn), AISystem + CombatSystem (per frame)
  // Read by:    CombatSystem, AISystem, RenderSystem, HUDSystem
  enemies: [],

  // Written by: CombatSystem (push new entries)
  // Updated by: PopSystem
  // Read by:    RenderSystem
  pops: [],

  // Written by: game.js (via GameEvents)
  // Read by:    HUDSystem, main loop
  phase: 'playing',  // 'playing' | 'won' | 'lost'

  // Written by: CombatSystem | Read by: game.js (gates AISystem + MovementSystem)
  hitStopTimer: 0,

  // Written by: CombatSystem (player hurt) | Read by: HUDSystem (red vignette)
  hurtFlashTimer: 0,

  // Debug flags — toggled via backtick menu, never affect shipped logic
  debug: {
    open:               false,
    stationaryEnemies:  false,
  },
};
