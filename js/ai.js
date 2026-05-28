// ai.js — AISystem
// Drives all enemy state machines. Player damage is routed via GameEvents.
//
// State machine:
//   approach  — rush toward player until orbit range
//   orbit     — strafe around player at melee distance, waiting for attack slot
//   windup    — telegraph (! marker), commit to attack
//   attacking — lunge at player
//   cooldown  — post-attack backoff before re-entering orbit
//   stunned   — countered; stands still then re-approaches
//   knockback — flung back by player hit
//   dead
//
// ── Writes: World.enemies (all fields except hp)
// ── Reads:  World.player (x, y, r, iframes), World.enemies, World.ARENA
// ── Emits:  'enemy:attack:connect'
// ── Listens: nothing
const AISystem = (() => {
  const { clamp, dist, rand } = Utils;

  const orbitRange = (p, e) => p.r + e.r + 50;

  let _prevPlayerState = null;

  function update(dt) {
    if (World.debug.stationaryEnemies) return;
    const p         = World.player;
    const { ARENA } = World;
    const anyAggro  = World.enemies.some(e => e.state === 'windup' || e.state === 'attacking');

    // Pressure escalation: survivors attack more aggressively as numbers drop
    const livingCount = World.enemies.filter(e => e.state !== 'dead').length;
    const totalCount  = World.enemies.length;
    const pressure    = totalCount > 1 ? 1 - ((livingCount - 1) / (totalCount - 1)) : 0;
    const decideLo    = 0.8  - pressure * 0.5;
    const decideHi    = 2.2  - pressure * 1.4;
    const retryLo     = 0.4  - pressure * 0.2;
    const retryHi     = 1.0  - pressure * 0.5;

    // Player-attack reaction: true for one frame on attack state entry
    const playerJustAttacked = (p.state === 'attacking' || p.state === 'countering' || p.state === 'finishing')
                               && _prevPlayerState !== p.state;
    _prevPlayerState = p.state;

    for (const e of World.enemies) {
      if (e.state === 'dead') continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt * 5);

      const dx = p.x - e.x, dy = p.y - e.y;
      const d  = Math.hypot(dx, dy) || 1;
      e.facing = Math.atan2(dy, dx);

      switch (e.state) {

        // ── APPROACH: rush straight to orbit range ───────────────────────────
        case 'approach': {
          const OR = orbitRange(p, e);
          if (d > OR) {
            e.x = clamp(e.x + (dx/d)*e.speed*dt, ARENA.x+e.r, ARENA.x+ARENA.w-e.r);
            e.y = clamp(e.y + (dy/d)*e.speed*dt, ARENA.y+e.r, ARENA.y+ARENA.h-e.r);
          } else {
            // Reached orbit range — start circling
            e.state = 'orbit';
            e.orbitAngle = Math.atan2(e.y - p.y, e.x - p.x);
            e.decideTimer = rand(decideLo, decideHi);
          }
          break;
        }

        // ── ORBIT: strafe at melee range, wait for attack slot ───────────────
        case 'orbit': {
          e.decideTimer -= dt;
          e.orbitAngle += e.orbitDir * e.orbitSpeed * dt;

          // Occasional orbit direction reversal — makes circling unpredictable
          if (e.orbitFlipCooldown > 0) {
            e.orbitFlipCooldown -= dt;
          } else if (Math.random() < e.orbitFlipChance) {
            e.orbitDir *= -1;
            e.orbitFlipCooldown = 2.0;
          }

          // Move toward orbit target
          const OR  = orbitRange(p, e);
          const tx  = p.x + Math.cos(e.orbitAngle) * OR;
          const ty  = p.y + Math.sin(e.orbitAngle) * OR;
          const tdx = tx - e.x, tdy = ty - e.y;
          const td  = Math.hypot(tdx, tdy) || 1;
          const spd = e.speed * 0.6;
          if (td > 1) {
            e.x += (tdx / td) * Math.min(spd * dt, td);
            e.y += (tdy / td) * Math.min(spd * dt, td);
          }

          e.x = clamp(e.x, ARENA.x+e.r, ARENA.x+ARENA.w-e.r);
          e.y = clamp(e.y, ARENA.y+e.r, ARENA.y+ARENA.h-e.r);

          // Positional separation
          for (const other of World.enemies) {
            if (other === e || other.state === 'dead') continue;
            const sdx = e.x - other.x, sdy = e.y - other.y;
            const sd  = Math.hypot(sdx, sdy) || 1;
            const sep = e.r + other.r + 6;
            if (sd < sep) {
              const push = (sep - sd) * 0.45;
              e.x += (sdx / sd) * push;
              e.y += (sdy / sd) * push;
              e.orbitAngle = Math.atan2(e.y - p.y, e.x - p.x);
            }
          }

          // Angular flanking spread — push orbit angles apart when within 60°
          for (const other of World.enemies) {
            if (other === e || other.state !== 'orbit') continue;
            let angleDiff = e.orbitAngle - other.orbitAngle;
            while (angleDiff >  Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            const absAD = Math.abs(angleDiff);
            const minAngSep = Math.PI / 3; // 60°
            if (absAD < minAngSep && absAD > 0.001) {
              const nudge = (minAngSep - absAD) * 0.04 * dt * 60;
              e.orbitAngle += (angleDiff > 0 ? 1 : -1) * nudge;
              const OR2 = orbitRange(p, e);
              e.x = clamp(p.x + Math.cos(e.orbitAngle) * OR2, ARENA.x+e.r, ARENA.x+ARENA.w-e.r);
              e.y = clamp(p.y + Math.sin(e.orbitAngle) * OR2, ARENA.y+e.r, ARENA.y+ARENA.h-e.r);
            }
          }

          // Attack decision
          if (e.decideTimer <= 0) {
            if (playerJustAttacked && e.decideTimer > -0.3) {
              // Player just struck — hesitate before committing
              e.decideTimer = rand(0.15, 0.4);
            } else if (!anyAggro) {
              e.state = 'windup';
              e.stateTimer = e.windupDur;
            } else {
              e.decideTimer = rand(retryLo, retryHi);
            }
          }
          break;
        }

        // ── WINDUP: telegraph attack with ! indicator ────────────────────────
        case 'windup': {
          // Feint: cancel the telegraph and retreat to orbit
          if (e.feintChance > 0 && Math.random() < e.feintChance * dt) {
            e.state       = 'orbit';
            e.orbitAngle  = Math.atan2(e.y - p.y, e.x - p.x);
            e.decideTimer = rand(decideLo, decideHi);
            break;
          }
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.state = 'attacking';
            e.stateTimer = 0.14;
            e.vx = (dx/d) * 340;
            e.vy = (dy/d) * 340;
          }
          break;
        }

        // ── ATTACKING: lunge toward player ───────────────────────────────────
        case 'attacking': {
          e.stateTimer -= dt;
          e.x = clamp(e.x + e.vx*dt, ARENA.x+e.r, ARENA.x+ARENA.w-e.r);
          e.y = clamp(e.y + e.vy*dt, ARENA.y+e.r, ARENA.y+ARENA.h-e.r);

          // iframes check: CombatSystem listener owns all damage logic
          if (p.iframes <= 0 && dist(e, p) < p.r + e.r) {
            GameEvents.emit('enemy:attack:connect', { enemy: e });
            // listener sets e.state = 'cooldown' synchronously
          }

          if (e.stateTimer <= 0 && e.state === 'attacking') {
            // Missed — enter cooldown and back off
            e.state = 'cooldown';
            e.stateTimer = e.cooldownDur * 0.7; // shorter cooldown on miss
          }
          break;
        }

        // ── COOLDOWN: back away before re-joining the orbit ──────────────────
        case 'cooldown': {
          e.stateTimer -= dt;

          // Retreat away from player
          const backDist = p.r + e.r + 90;
          if (d < backDist) {
            const bdx = e.x - p.x, bdy = e.y - p.y;
            const bd  = Math.hypot(bdx, bdy) || 1;
            e.x = clamp(e.x + (bdx/bd)*e.speed*0.55*dt, ARENA.x+e.r, ARENA.x+ARENA.w-e.r);
            e.y = clamp(e.y + (bdy/bd)*e.speed*0.55*dt, ARENA.y+e.r, ARENA.y+ARENA.h-e.r);
          }

          if (e.stateTimer <= 0) {
            e.state = 'approach'; // re-rush to orbit range
          }
          break;
        }

        // ── STUNNED: frozen after counter ────────────────────────────────────
        case 'stunned': {
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.state = 'approach';
          }
          break;
        }

        // ── KNOCKBACK: flung by player hit ───────────────────────────────────
        case 'knockback': {
          e.stateTimer -= dt;
          e.x = clamp(e.x + e.vx*dt, ARENA.x+e.r, ARENA.x+ARENA.w-e.r);
          e.y = clamp(e.y + e.vy*dt, ARENA.y+e.r, ARENA.y+ARENA.h-e.r);
          e.vx *= 0.78; e.vy *= 0.78;
          if (e.stateTimer <= 0) {
            e.state = 'approach'; e.vx = 0; e.vy = 0;
          }
          break;
        }
      }
    }
  }

  return { update };
})();
