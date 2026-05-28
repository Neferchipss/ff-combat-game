// input.js — InputSystem
// Reads keyboard and Gamepad API each frame and writes normalised input to World.
//
// Aim direction (World.input.aimX/aimY):
//   Gamepad: right stick when its magnitude > deadzone; otherwise left stick direction.
//   Keyboard: movement direction (WASD); if standing still, (0,0) → CombatSystem
//             falls back to player.facing.
//
// ── Writes: World.input (mx, my, attackDown, counterDown, counterHeld,
//                         finisherDown, aimX, aimY)
// ── Reads:  keyboard events, Gamepad API
// ── Emits:  nothing
// ── Listens: nothing
const InputSystem = (() => {
  const _keys = Object.create(null);
  const _cur  = { attack: false, counter: false, finisher: false };
  const _prev = { attack: false, counter: false, finisher: false };

  function init() {
    window.addEventListener('keydown', e => {
      // Backtick: toggle debug menu
      if (e.code === 'Backquote') {
        World.debug.open = !World.debug.open;
        e.preventDefault();
        return;
      }
      // Number keys toggle debug options when menu is open
      if (World.debug.open) {
        if (e.code === 'Digit1') { World.debug.stationaryEnemies = !World.debug.stationaryEnemies; e.preventDefault(); return; }
      }
      _keys[e.code] = true;
      e.preventDefault();
    });
    window.addEventListener('keyup', e => { _keys[e.code] = false; });
  }

  function update() {
    _prev.attack   = _cur.attack;
    _prev.counter  = _cur.counter;
    _prev.finisher = _cur.finisher;

    const gp = navigator.getGamepads?.()[0] ?? null;

    // ── Movement (left stick / WASD) ──
    let mx = 0, my = 0;
    if (_keys['KeyA'] || _keys['ArrowLeft'])  mx -= 1;
    if (_keys['KeyD'] || _keys['ArrowRight']) mx += 1;
    if (_keys['KeyW'] || _keys['ArrowUp'])    my -= 1;
    if (_keys['KeyS'] || _keys['ArrowDown'])  my += 1;

    let aimX = mx, aimY = my; // keyboard: aim = movement direction

    if (gp) {
      const lx = gp.axes[0], ly = gp.axes[1];
      if (Math.abs(lx) > 0.15) mx += lx;
      if (Math.abs(ly) > 0.15) my += ly;

      // Right stick overrides aim when pushed past deadzone
      const rx = gp.axes[2] ?? 0, ry = gp.axes[3] ?? 0;
      if (Math.hypot(rx, ry) > 0.2) {
        aimX = rx; aimY = ry;
      } else {
        // Right stick centred: aim follows left stick
        aimX = (Math.abs(lx) > 0.15 ? lx : 0);
        aimY = (Math.abs(ly) > 0.15 ? ly : 0);
      }

      _cur.attack   = !!gp.buttons[2]?.pressed;  // X
      _cur.counter  = !!gp.buttons[3]?.pressed;  // Y
      _cur.finisher = !!gp.buttons[1]?.pressed;  // B  (A = buttons[0], nothing for now)
    } else {
      _cur.attack   = !!(_keys['KeyJ'] || _keys['Space']);
      _cur.counter  = !!_keys['KeyK'];
      _cur.finisher = !!_keys['KeyE'];
    }

    // Normalise movement
    const mlen = Math.hypot(mx, my);
    if (mlen > 1) { mx /= mlen; my /= mlen; }

    World.input.mx           = mx;
    World.input.my           = my;
    World.input.aimX         = aimX;
    World.input.aimY         = aimY;
    World.input.attackDown   = _cur.attack   && !_prev.attack;
    World.input.counterDown  = _cur.counter  && !_prev.counter;
    World.input.counterHeld  = _cur.counter;
    World.input.finisherDown = _cur.finisher && !_prev.finisher;
  }

  return { init, update };
})();
