// hud.js — HUDSystem
// Draws UI overlay: combo counter + chain bar, HP bar, controls hint, phase overlays,
// finisher prompt, and hurt vignette.
// ── Writes: nothing
// ── Reads:  World.ctx, .W, .H, .player, .phase, .hurtFlashTimer
// ── Emits:  nothing
// ── Listens: nothing
const HUDSystem = (() => {
  const { comboColor } = Utils;

  function render() {
    const { ctx, W, H, player: p, phase } = World;

    // ── Hurt vignette: red edge flash when player takes damage ──
    if (World.hurtFlashTimer > 0) {
      const alpha = Math.min(World.hurtFlashTimer / 0.45, 1) * 0.55;
      const grad  = ctx.createRadialGradient(W/2, H/2, H * 0.3, W/2, H/2, H * 0.75);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, `rgba(200,0,0,${alpha})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // ── Combo counter ──
    if (p.combo > 0) {
      const fade = Math.min(p.comboTimer / 0.5, 1);
      ctx.globalAlpha = fade;
      ctx.font = `bold ${44 + Math.min(p.combo, 12) * 2}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = comboColor(p.combo);
      ctx.fillText(`${p.combo}`, 24, H - 48);
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#aaa';
      ctx.fillText('COMBO', 28, H - 28);
      ctx.globalAlpha = 1;

      // Chain window bar — drains as window closes
      const bw = 120;
      ctx.fillStyle = '#222'; ctx.fillRect(24, H - 20, bw, 5);
      ctx.fillStyle = comboColor(p.combo);
      ctx.fillRect(24, H - 20, bw * (p.comboTimer / p.chainWindow), 5);

      // ── Finisher prompt ──
      if (p.combo >= p.finisherThreshold && p.state === 'idle') {
        const pulse = 0.75 + 0.25 * Math.sin(Date.now() / 130);
        ctx.globalAlpha = pulse;
        ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
        ctx.fillStyle = '#ffd700';
        ctx.fillText('[ E / Ⓑ ]  FINISH', 24, H - 68);
        ctx.globalAlpha = 1;
      }
    }

    // ── HP bar ──
    const hbw = 120;
    ctx.fillStyle = '#222';    ctx.fillRect(W - hbw - 24, H - 44, hbw, 14);
    ctx.fillStyle = '#e94560'; ctx.fillRect(W - hbw - 24, H - 44, hbw * (p.hp / p.maxHp), 14);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
    ctx.strokeRect(W - hbw - 24, H - 44, hbw, 14);
    ctx.fillStyle = '#ccc'; ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('HP', W - hbw - 30, H - 33);

    // ── Controls hint ──
    ctx.fillStyle = '#333'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('WASD Move  |  J/Space/Ⓧ Attack  |  K/Ⓨ Counter  |  E/Ⓑ Finish (×8)', W / 2, H - 10);

    // ── Debug menu ──
    if (World.debug.open) {
      const opts = [
        { key: '1', label: 'Stationary enemies', val: World.debug.stationaryEnemies },
      ];
      const pw = 248, ph = 36 + opts.length * 22;
      const px = 16,  py = 16;

      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = '#444'; ctx.lineWidth = 1;
      ctx.strokeRect(px, py, pw, ph);

      ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
      ctx.fillStyle = '#666';
      ctx.fillText('DEBUG  [ ` to close ]', px + 10, py + 16);

      opts.forEach((o, i) => {
        ctx.font = '11px monospace';
        ctx.fillStyle = '#555';
        ctx.fillText(`[${o.key}]`, px + 10, py + 32 + i * 22);
        ctx.fillStyle = o.val ? '#00e676' : '#888';
        ctx.fillText(`${o.label}`, px + 36, py + 32 + i * 22);
        ctx.fillStyle = o.val ? '#00e676' : '#555';
        ctx.fillText(o.val ? 'ON' : 'OFF', px + pw - 36, py + 32 + i * 22);
      });
    }

    // ── Phase overlays ──
    if (phase === 'won') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffe066'; ctx.font = 'bold 64px monospace'; ctx.textAlign = 'center';
      ctx.fillText('CLEAR', W/2, H/2 - 20);
      ctx.fillStyle = '#aaa'; ctx.font = '20px monospace';
      ctx.fillText(`Combo: ${p.combo}`, W/2, H/2 + 28);
    }
    if (phase === 'lost') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e94560'; ctx.font = 'bold 64px monospace'; ctx.textAlign = 'center';
      ctx.fillText('DOWN', W/2, H/2 - 20);
      ctx.fillStyle = '#888'; ctx.font = '20px monospace';
      ctx.fillText('Refresh to retry', W/2, H/2 + 28);
    }
  }

  return { render };
})();
