// game.js — Orchestration only. No game logic lives here.
// Owns: canvas setup, system init order, update order, game phase via events.
// To change wave config: edit the spawnWave call below.
// To change player config: pass an override object to EntitySystem.init().
(function () {
  // ── Canvas ──
  const canvas    = document.getElementById('c');
  World.canvas    = canvas;
  World.ctx       = canvas.getContext('2d');
  canvas.width    = World.W;
  canvas.height   = World.H;

  // ── Phase transitions (via events, not polling) ──
  GameEvents.on('player:dead', () => {
    World.phase = 'lost';
  });
  GameEvents.on('enemy:dead', () => {
    if (World.enemies.length && World.enemies.every(e => e.state === 'dead')) {
      World.phase = 'won';
    }
  });

  // ── Init ──
  InputSystem.init();
  EntitySystem.init(/* playerCfg = {} */);
  EntitySystem.spawnWave(5 /* , enemyCfg = {} */);

  // ── Loop ──
  let prev = null;

  function loop(ts) {
    if (!prev) prev = ts;
    const dt = Math.min((ts - prev) / 1000, 0.05);
    prev = ts;

    if (World.phase === 'playing') {
      InputSystem.update();       // 1. raw input → World.input (always runs, keeps buttons responsive)
      CombatSystem.update(dt);    // 2. player combat (always runs so attack chains feel instant)

      if (World.hitStopTimer > 0) {
        // Freeze enemies and movement during hit stop — creates the Arkham "impact crunch"
        World.hitStopTimer -= dt;
      } else {
        MovementSystem.update(dt);  // 3. free movement (idle only)
        AISystem.update(dt);        // 4. enemy state machines
        PopSystem.update(dt);       // 5. advance + cull floating text
      }
    }

    RenderSystem.render();        // 6. draw world
    HUDSystem.render();           // 7. draw UI on top

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}());
