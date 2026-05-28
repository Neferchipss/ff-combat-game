// renderer.js — RenderSystem
// Pure draw pass. Reads World, writes nothing. No state of its own.
// ── Writes: nothing
// ── Reads:  World.ctx, .W, .H, .ARENA, .TILE, .player, .enemies, .pops
// ── Emits:  nothing
// ── Listens: nothing
const RenderSystem = (() => {
  const { comboColor } = Utils;

  function drawArena() {
    const { ctx, W, H, ARENA, TILE } = World;
    ctx.fillStyle = '#0b0b18'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#10102a'; ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);

    ctx.strokeStyle = '#181830'; ctx.lineWidth = 1;
    for (let x = ARENA.x; x <= ARENA.x + ARENA.w; x += TILE) {
      ctx.beginPath(); ctx.moveTo(x, ARENA.y); ctx.lineTo(x, ARENA.y + ARENA.h); ctx.stroke();
    }
    for (let y = ARENA.y; y <= ARENA.y + ARENA.h; y += TILE) {
      ctx.beginPath(); ctx.moveTo(ARENA.x, y); ctx.lineTo(ARENA.x + ARENA.w, y); ctx.stroke();
    }

    ctx.strokeStyle = '#2a2a55'; ctx.lineWidth = 3;
    ctx.strokeRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
  }

  function drawShadow(x, y, r) {
    const { ctx } = World;
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + r - 3, r * 0.8, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawEnemy(e) {
    const { ctx } = World;

    if (e.state === 'dead') {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#334';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    drawShadow(e.x, e.y, e.r);

    const fl = e.hitFlash > 0;
    let col = '#1e4a88';
    if (fl)                         col = '#ffffff';
    else if (e.state === 'windup')   col = '#7a5500';
    else if (e.state === 'attacking') col = '#7a2200';
    else if (e.state === 'stunned')   col = '#1a3a1a';

    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();

    // Facing dot
    ctx.fillStyle = fl ? '#88aaff' : '#3366cc';
    ctx.beginPath();
    ctx.arc(e.x + Math.cos(e.facing)*(e.r-6), e.y + Math.sin(e.facing)*(e.r-6), 5, 0, Math.PI * 2);
    ctx.fill();

    // HP bar
    const bw = e.r * 2.4;
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(e.x - bw/2, e.y - e.r - 11, bw, 4);
    ctx.fillStyle = '#e94560'; ctx.fillRect(e.x - bw/2, e.y - e.r - 11, bw * (e.hp / e.maxHp), 4);

    // Telegraph ring + exclamation
    if (e.state === 'windup') {
      const ratio = e.stateTimer / e.windupDur;  // 1 → 0 as attack approaches
      const pulse = 0.75 + 0.25 * Math.sin(Date.now() / 75);
      const tcol  = ratio > 0.45 ? '#ffdd00' : '#ff2200';
      ctx.globalAlpha = pulse;
      ctx.fillStyle = tcol;
      ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center';
      ctx.fillText('!', e.x, e.y - e.r - 14);
      ctx.strokeStyle = tcol; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6 + ratio * 10, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawPlayer(p) {
    if (p.state === 'dead') return;
    const { ctx } = World;

    // Combo / finisher-ready glow
    if (p.combo >= p.finisherThreshold) {
      // Pulsing gold ring when finisher is available
      const pulse = 0.3 + 0.2 * Math.sin(Date.now() / 120);
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 8, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (p.combo > 0) {
      const g    = Math.min(p.combo / 10, 1);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r + 20);
      grad.addColorStop(0, comboColor(p.combo));
      grad.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.1 + g * 0.2;
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 20, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    drawShadow(p.x, p.y, p.r);

    let col = '#e94560';
    if (p.state === 'hurt')       col = '#ff3333';
    if (p.state === 'attacking')  col = '#ffaa00';
    if (p.state === 'countering') col = '#00d4ff';
    if (p.state === 'finishing')  col = '#ffd700';
    if (p.iframes > 0 && Math.floor(p.iframes * 20) % 2 === 0) col = '#ffffff';

    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();

    // Facing dot
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.facing)*(p.r-6), p.y + Math.sin(p.facing)*(p.r-6), 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAimLine(p) {
    const { ctx } = World;
    const inp  = World.input;
    const aLen = Math.hypot(inp.aimX, inp.aimY);
    const ax   = aLen > 0.1 ? inp.aimX / aLen : Math.cos(p.facing);
    const ay   = aLen > 0.1 ? inp.aimY / aLen : Math.sin(p.facing);

    const attacking = p.state === 'attacking';
    const visible   = !attacking || Math.floor(Date.now() / 70) % 2 === 0;

    ctx.globalAlpha = visible ? 0.6 : 0;
    ctx.strokeStyle = attacking ? '#ffaa00' : '#00d4ff';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + ax * p.attackRange, p.y + ay * p.attackRange);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  function drawPops() {
    const { ctx } = World;
    for (const p of World.pops) {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.font = `bold ${p.size}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    drawArena();
    for (const e of World.enemies) drawEnemy(e);
    drawAimLine(World.player);
    drawPlayer(World.player);
    drawPops();
  }

  return { render };
})();
