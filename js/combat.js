// combat.js — CombatSystem
// Owns player-initiated combat and player damage receipt.
//
// Targeting rules:
//   World.input.aimX/aimY gives a preferred direction (right stick / movement keys).
//   targetInDirection()   picks the live enemy most aligned with that direction.
//   telegraphInDirection() does the same but only among windup-state enemies.
//   Both fall back to nearest if no enemy is in the front hemisphere.
//
// Range rules (tunable in EntitySystem.PLAYER_DEFAULTS):
//   p.attackRange — if the chosen target is within this distance, the player
//                   snaps to them (standard dash). Hit lands.
//   p.missLunge   — if target is beyond attackRange, player lurches this many
//                   px in the enemy's direction. No hit lands, no stun, no combo.
//
// ── Writes: World.player (state, combo, iframes, x/y during dash)
//            World.enemies (state, hp, vx/vy on hit)
//            World.pops, World.hitStopTimer, World.hurtFlashTimer
// ── Reads:  World.input, World.player, World.enemies
// ── Emits:  'hit', 'counter', 'player:hurt', 'player:dead', 'enemy:dead', 'combo:break', 'combo:end'
// ── Listens: 'enemy:attack:connect'
const CombatSystem = (() => {
  const { clamp, dist, easeOut, comboColor } = Utils;

  // ── Targeting ─────────────────────────────────────────────────────────────

  // Resolve aim direction: right-stick / movement → fallback to player facing.
  function aimDir() {
    const { aimX, aimY } = World.input;
    const len = Math.hypot(aimX, aimY);
    if (len > 0.1) return { ax: aimX / len, ay: aimY / len };
    const p = World.player;
    return { ax: Math.cos(p.facing), ay: Math.sin(p.facing) };
  }

  // Displacing attack (combo ≥ 3): enemy whose position is closest to the aim
  // segment [player → player + aimDir * attackRange]. This makes the rendered
  // aim line the literal selection tool — sweeping the stick cycles targets.
  // No-input fallback: nearest enemy within attackRange.
  function targetOnAimLine() {
    const inp = World.input;
    const p   = World.player;

    if (Math.hypot(inp.aimX, inp.aimY) <= 0.1) {
      let best = null, bestDist = Infinity;
      for (const e of World.enemies) {
        if (e.state === 'dead') continue;
        const d = dist(p, e);
        if (d > p.attackRange) continue;
        if (d < bestDist) { bestDist = d; best = e; }
      }
      return best;
    }

    const { ax, ay } = aimDir();
    let best = null, bestLineDist = Infinity;
    for (const e of World.enemies) {
      if (e.state === 'dead') continue;
      if (dist(p, e) > p.attackRange) continue;
      const ex       = e.x - p.x, ey = e.y - p.y;
      const proj     = ex * ax + ey * ay;                           // scalar along aim
      const t        = Math.max(0, Math.min(p.attackRange, proj));  // clamp to segment
      const lineDist = Math.hypot(ex - t * ax, ey - t * ay);       // dist to closest point
      if (lineDist < bestLineDist) { bestLineDist = lineDist; best = e; }
    }
    return best;
  }

  // Normal attack (combo < 3): nearest enemy within meleeRange, direction-independent.
  function nearestInMeleeRange() {
    const p = World.player;
    let best = null, bestDist = Infinity;
    for (const e of World.enemies) {
      if (e.state === 'dead') continue;
      const d = dist(p, e);
      if (d > p.meleeRange) continue;
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  // Nearest windup enemy within attackRange — direction-independent.
  // Returns null if no windup enemy is in range.
  function telegraphInDirection() {
    const p = World.player;
    let best = null, bestDist = Infinity;
    for (const e of World.enemies) {
      if (e.state !== 'windup') continue;
      const d = dist(p, e);
      if (d > p.attackRange) continue;
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Sets up a dash toward target. If target is within p.attackRange, snap to them
  // (p.target = target, hit will land). If beyond range, short lunge in target's
  // direction (p.target = null, hit will not land).
  function setupDash(p, target) {
    const dx = target.x - p.x, dy = target.y - p.y;
    const d  = Math.hypot(dx, dy) || 1;
    p.fromX  = p.x; p.fromY = p.y;
    p.facing = Math.atan2(dy, dx);

    if (d <= p.attackRange) {
      // In range — snap to enemy
      p.toX    = target.x - (dx / d) * (p.r + target.r + 5);
      p.toY    = target.y - (dy / d) * (p.r + target.r + 5);
      p.target = target;
    } else {
      // Out of range — lunge forward, no hit
      const { ARENA } = World;
      p.toX    = clamp(p.fromX + (dx / d) * p.missLunge, ARENA.x + p.r, ARENA.x + ARENA.w - p.r);
      p.toY    = clamp(p.fromY + (dy / d) * p.missLunge, ARENA.y + p.r, ARENA.y + ARENA.h - p.r);
      p.target = null;
    }
  }

  function pushPop(x, y, text, color, size = 18) {
    World.pops.push({ x, y, vy: -55, text, color, size, life: 0.9, max: 0.9 });
  }

  // Standard hit: 1 damage, knockback, combo++
  function resolveHit(e) {
    if (!e || e.state === 'dead') return;
    e.hp--;
    e.hitFlash = 0.18;
    if (e.hp <= 0) {
      e.state = 'dead';
      pushPop(e.x, e.y - 22, 'KO', '#e94560', 26);
      GameEvents.emit('enemy:dead', { enemy: e });
    } else {
      const dx = e.x - World.player.x, dy = e.y - World.player.y;
      const d  = Math.hypot(dx, dy) || 1;
      e.state      = 'knockback';
      e.stateTimer = 0.32;
      e.vx = (dx / d) * 210;
      e.vy = (dy / d) * 210;
    }
    World.player.combo++;
    World.player.comboTimer = World.player.chainWindow;
    World.hitStopTimer = 0.05;
  }

  // Finisher hit: 3 damage, heavy knockback, spends combo, slow-mo
  function resolveFinisher(e) {
    if (!e || e.state === 'dead') return;
    e.hp = Math.max(0, e.hp - 3);
    e.hitFlash = 0.35;
    if (e.hp <= 0) {
      e.state = 'dead';
      pushPop(e.x, e.y - 22, 'KO', '#ffd700', 30);
      GameEvents.emit('enemy:dead', { enemy: e });
    } else {
      const dx = e.x - World.player.x, dy = e.y - World.player.y;
      const d  = Math.hypot(dx, dy) || 1;
      e.state      = 'knockback';
      e.stateTimer = 0.55;
      e.vx = (dx / d) * 320;
      e.vy = (dy / d) * 320;
    }
    World.player.combo      = 0;
    World.player.comboTimer = 0;
    World.hitStopTimer      = 0.32;
    GameEvents.emit('combo:end', {});
  }

  // ── Event listener: enemy reached player ─────────────────────────────────
  GameEvents.on('enemy:attack:connect', ({ enemy }) => {
    const p = World.player;
    p.hp -= 2;
    p.iframes    = 0.55;
    p.combo      = 0;
    p.comboTimer = 0;
    p.state      = 'hurt';
    p.stateTimer = 0.28;
    enemy.state      = 'cooldown';
    enemy.stateTimer = enemy.cooldownDur;
    pushPop(p.x, p.y - 28, 'HIT!', '#ff4040', 20);
    World.hurtFlashTimer = 0.45;
    GameEvents.emit('combo:break', {});
    GameEvents.emit('player:hurt', { hp: p.hp });
    if (p.hp <= 0) {
      p.state = 'dead';
      GameEvents.emit('player:dead', {});
    }
  });

  // ── Per-frame update ──────────────────────────────────────────────────────
  function update(dt) {
    const p   = World.player;
    const inp = World.input;

    if (p.iframes > 0) p.iframes -= dt;
    if (World.hurtFlashTimer > 0) World.hurtFlashTimer -= dt;

    // ── Idle: combo decay + input ──
    if (p.state === 'idle') {
      if (p.combo > 0) {
        p.comboTimer -= dt;
        if (p.comboTimer <= 0) {
          p.combo = 0;
          GameEvents.emit('combo:end', {});
        }
      }

      // Finisher — aim-line target required; no fire on whiff (spending combo on air is bad UX)
      if (inp.finisherDown && p.combo >= p.finisherThreshold) {
        const t = targetOnAimLine();
        if (t) {
          setupDash(p, t);
          t.state = 'cooldown'; t.stateTimer = 0.08;
          p.state = 'finishing'; p.stateTimer = p.finisherDur;
        }

      // Attack — combo < 3: nearest in meleeRange, strike in place;
      //          combo ≥ 3: aim-line selection within attackRange, snap to enemy
      } else if (inp.attackDown) {
        const t = p.combo >= 3 ? targetOnAimLine() : nearestInMeleeRange();
        if (t) {
          if (p.combo >= 3) {
            setupDash(p, t);
          } else {
            // Stationary strike — face the enemy, stay put, hit still resolves
            const dx = t.x - p.x, dy = t.y - p.y;
            p.fromX = p.x; p.fromY = p.y;
            p.toX   = p.x; p.toY   = p.y;
            p.facing = Math.atan2(dy, dx);
            p.target = t;
          }
          if (t.state === 'windup') { t.state = 'stunned';  t.stateTimer = 0.5; }
          else                      { t.state = 'cooldown'; t.stateTimer = 0.08; }
          p.state = 'attacking'; p.stateTimer = p.attackDur;
        }

      // Counter — fires when any windup enemy is within attackRange, direction-independent
      } else if (inp.counterDown) {
        const t = telegraphInDirection();
        if (t) {
          setupDash(p, t);
          t.state = 'stunned'; t.stateTimer = 1.1;
          p.state = 'countering'; p.stateTimer = p.counterDur;
        }
      }
    }

    // ── Dash + finisher animations ──
    if (p.state === 'attacking' || p.state === 'countering' || p.state === 'finishing') {
      p.stateTimer -= dt;
      const dur = p.state === 'attacking'  ? p.attackDur
                : p.state === 'countering' ? p.counterDur
                :                            p.finisherDur;
      const t = easeOut(clamp(1 - p.stateTimer / dur, 0, 1));
      p.x = p.fromX + (p.toX - p.fromX) * t;
      p.y = p.fromY + (p.toY - p.fromY) * t;

      if (p.stateTimer <= 0) {
        const e           = p.target; // null means the lunge was out-of-range (miss)
        const wasCounter  = p.state === 'countering';
        const wasFinisher = p.state === 'finishing';

        if (e !== null) {
          // Hit landed
          if (wasFinisher) {
            resolveFinisher(e);
            pushPop(e.x, e.y - 32, 'FINISH!', '#ffd700', 28);
          } else {
            resolveHit(e);
            if (wasCounter) {
              pushPop(e.x, e.y - 30, 'COUNTER!', '#00d4ff', 22);
              GameEvents.emit('counter', { enemy: e, combo: p.combo });
            } else {
              const label = p.combo > 1 ? `${p.combo}x` : 'HIT';
              pushPop(e.x, e.y - 30, label, comboColor(p.combo), 14 + Math.min(p.combo, 10));
              GameEvents.emit('hit', { enemy: e, combo: p.combo });
            }
          }
        }
        // If e === null: animation played but nothing happened — no pop, no combo, no events

        p.state = 'idle'; p.target = null;

        // Counter chain: only if the counter actually landed and button is still held
        if (wasCounter && e !== null && inp.counterHeld) {
          const next = telegraphInDirection();
          if (next) {
            setupDash(p, next);
            if (p.target !== null) { next.state = 'stunned'; next.stateTimer = 1.1; }
            p.state = 'countering'; p.stateTimer = p.counterDur;
          }
        }
      }
    }

    // ── Hurt recovery ──
    if (p.state === 'hurt') {
      p.stateTimer -= dt;
      if (p.stateTimer <= 0) p.state = 'idle';
    }
  }

  return { update };
})();
