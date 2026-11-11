// Play tab: Hot Streak (free-throw meter, endless + daily 10-shot challenge) and Buzzer Rush (timed swipe-shooting arcade)
(function () {
  const W = 360, H = 480;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#000';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  // small seeded RNG so everyone gets the same daily challenge
  function rng(seedStr) { let h = 1779033703 ^ seedStr.length; for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }

  function setupCanvas(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return c;
  }
  const font = (w, s) => `${w} ${s}px "Barlow Condensed", sans-serif`;

  function drawCourt(c, hoopX, hoopY, rimW) {
    c.fillStyle = css('--paper'); c.fillRect(0, 0, W, H);
    c.strokeStyle = css('--rule'); c.lineWidth = 2;
    c.beginPath(); c.arc(W / 2, H + 40, 250, Math.PI, 2 * Math.PI); c.stroke();          // three-point arc
    c.strokeRect(W / 2 - 60, H - 170, 120, 170);                                        // lane
    // backboard + rim + net
    c.fillStyle = css('--ink'); c.fillRect(hoopX - 46, hoopY - 52, 92, 6);
    c.strokeStyle = css('--rule2'); c.lineWidth = 2; c.strokeRect(hoopX - 18, hoopY - 46, 36, 26);
    c.strokeStyle = css('--mute'); c.lineWidth = 1.2;
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(hoopX - rimW / 2 + (rimW / 4) * i, hoopY); c.lineTo(hoopX - rimW / 3 + (rimW / 6) * i, hoopY + 30); c.stroke(); }
    c.strokeStyle = '#e07a2e'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(hoopX - rimW / 2, hoopY); c.lineTo(hoopX + rimW / 2, hoopY); c.stroke();
  }
  function drawBall(c, x, y, r) {
    c.fillStyle = '#e07a2e'; c.beginPath(); c.arc(x, y, r, 0, 2 * Math.PI); c.fill();
    c.strokeStyle = '#7a3a10'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(x, y, r, 0, 2 * Math.PI); c.stroke();
    c.beginPath(); c.moveTo(x - r, y); c.lineTo(x + r, y); c.moveTo(x, y - r); c.lineTo(x, y + r); c.stroke();
  }
  function centerText(c, t, y, f, col) { c.font = f; c.fillStyle = col; c.textAlign = 'center'; c.fillText(t, W / 2, y); }

  // ---------------- Hot Streak ----------------
  function HotStreak(cv, ui) {
    const c = setupCanvas(cv);
    const HX = W / 2, HY = 150, RIM = 54;
    let mode = 'endless', state = 'ready', t0 = 0, phase = 0, streak = 0, shot = null, results = [], daily = null, flash = '';
    const best = () => store.get('hs-best', 0);

    function params(i) { // meter speed + green-zone width for shot i
      if (mode === 'daily') return daily[i];
      return { speed: 1.5 + 0.2 * i, zone: Math.max(0.05, 0.3 - 0.02 * i), phase: Math.random() * 6.28 };
    }
    function buildDaily() {
      const r = rng('hawks-' + todayKey());
      daily = Array.from({ length: 10 }, (_, i) => ({ speed: 1.6 + i * 0.22 + r() * 0.6, zone: Math.max(0.06, 0.26 - i * 0.017 - r() * 0.03), phase: r() * 6.28 }));
    }
    function shotIndex() { return mode === 'daily' ? results.length : streak; }
    function meterPos(now) { const p = params(shotIndex()); return 0.5 + 0.5 * Math.sin(phase + ((now - t0) / 1000) * p.speed * Math.PI); }

    function start(m) {
      mode = m; streak = 0; results = []; shot = null; flash = '';
      if (m === 'daily') {
        buildDaily();
        const saved = store.get('hs-daily-' + todayKey(), null);
        if (saved) { results = saved; state = 'done'; ui(); return; }
      }
      state = 'aim'; t0 = performance.now(); phase = params(0).phase; ui();
    }
    function shoot() {
      if (state === 'ready' || state === 'over' || state === 'done') { if (state !== 'done') start(mode); return; }
      if (state !== 'aim') return;
      const now = performance.now(), p = meterPos(now), z = params(shotIndex()).zone, off = Math.abs(p - 0.5);
      const kind = off < z / 4 ? 'swish' : off < z / 2 ? 'make' : 'miss';
      shot = { start: now, kind, dir: p - 0.5 };
      state = 'flying';
    }
    function land() {
      const made = shot.kind !== 'miss';
      flash = shot.kind === 'swish' ? 'SWISH' : made ? 'GOOD' : 'CLANK';
      if (mode === 'endless') {
        if (made) { streak++; if (streak > best()) store.set('hs-best', streak); state = 'aim'; }
        else state = 'over';
      } else {
        results.push(shot.kind === 'swish' ? 2 : made ? 1 : 0);
        if (results.length === 10) { state = 'done'; store.set('hs-daily-' + todayKey(), results); } else state = 'aim';
      }
      if (state === 'aim') { t0 = performance.now(); phase = params(shotIndex()).phase; }
      shot = null; ui();
    }

    function frame(now) {
      drawCourt(c, HX, HY, RIM);
      // header
      c.textAlign = 'left'; c.font = font(700, 18); c.fillStyle = css('--mute');
      if (mode === 'endless') { c.fillText(`STREAK ${streak}`, 14, 28); c.textAlign = 'right'; c.fillText(`BEST ${best()}`, W - 14, 28); }
      else { c.fillText(`DAILY · SHOT ${Math.min(results.length + 1, 10)}/10`, 14, 28); c.textAlign = 'right'; c.fillText(`${results.filter(Boolean).length} MADE`, W - 14, 28); }
      // ball
      let bx = W / 2, by = H - 110;
      if (state === 'flying') {
        const k = Math.min(1, (now - shot.start) / 700), ex = HX + (shot.kind === 'miss' ? shot.dir * 120 + Math.sign(shot.dir || 1) * 24 : shot.dir * 10);
        bx = W / 2 + (ex - W / 2) * k; by = (H - 110) + (HY - 8 - (H - 110)) * k - Math.sin(k * Math.PI) * 140;
        if (k >= 1) { if (shot.kind === 'miss') { const k2 = Math.min(1, (now - shot.start - 700) / 350); bx = ex + Math.sign(shot.dir || 1) * 50 * k2; by = HY - 8 + 120 * k2 * k2 - 40 * Math.sin(k2 * Math.PI); if (k2 >= 1) land(); } else { const k2 = Math.min(1, (now - shot.start - 700) / 250); by = HY - 8 + 50 * k2; if (k2 >= 1) land(); } }
      }
      if (state !== 'done') drawBall(c, bx, by, 13);
      // meter
      if (state === 'aim' || state === 'flying') {
        const z = params(shotIndex()).zone, mx = 30, mw = W - 60, my = H - 52;
        c.fillStyle = css('--rule'); c.fillRect(mx, my, mw, 16);
        c.fillStyle = css('--good'); c.fillRect(mx + mw * (0.5 - z / 2), my, mw * z, 16);
        c.fillStyle = css('--navy'); c.fillRect(mx + mw * (0.5 - z / 8), my, mw * z / 4, 16);
        if (state === 'aim') { const p = meterPos(now); c.fillStyle = css('--ink'); c.fillRect(mx + mw * p - 2, my - 6, 4, 28); }
        c.font = font(600, 14); c.fillStyle = css('--mute'); c.textAlign = 'center'; c.fillText('TAP / SPACE TO SHOOT', W / 2, H - 14);
      }
      if (flash && state === 'aim') centerText(c, flash, HY + 90, font(800, 34), flash === 'CLANK' ? css('--bad') : css('--good'));
      if (state === 'ready') { centerText(c, 'HOT STREAK', 250, font(800, 44), css('--ink')); centerText(c, 'Stop the meter in the green.', 282, font(600, 18), css('--mute')); centerText(c, 'Tap or press Space to start', 310, font(600, 18), css('--navy')); }
      if (state === 'over') { centerText(c, 'CLANK', 240, font(800, 44), css('--bad')); centerText(c, `Streak: ${streak}  ·  Best: ${best()}`, 274, font(700, 22), css('--ink')); centerText(c, 'Tap or press Space to go again', 304, font(600, 18), css('--navy')); }
      if (state === 'done') {
        const made = results.filter(Boolean).length;
        centerText(c, `DAILY: ${made}/10`, 230, font(800, 44), css('--ink'));
        centerText(c, results.map((x) => (x === 2 ? '🔥' : x ? '🏀' : '⭕')).join(''), 270, '22px sans-serif', css('--ink'));
        centerText(c, 'New challenge tomorrow', 304, font(600, 18), css('--mute'));
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return {
      start, shoot,
      get mode() { return mode; }, get state() { return state; },
      shareText() { const made = results.filter(Boolean).length; return `Hawks Hot Streak daily ${todayKey()}: ${made}/10\n${results.map((x) => (x === 2 ? '🔥' : x ? '🏀' : '⭕')).join('')}\n${location.origin}${location.pathname}#play`; },
    };
  }

  // ---------------- Buzzer Rush (side view) ----------------
  function BuzzerRush(cv, ui) {
    const c = setupCanvas(cv);
    const G = 1000, R = 12, TIME = 45, FLOOR = 420, BOARD_X = 330;
    let state = 'ready', rimY = 190, rimDir = 1, score = 0, combo = 0, ends = 0, ball = null, flash = '', flashT = 0;
    let ang = 0.95, power = 0, charging = false, drag = null, last = performance.now();
    const rimL = () => BOARD_X - 84, rimR = () => BOARD_X - 8;
    const best = () => store.get('br-best', 0);
    const pos = (e) => ({ x: e.offsetX * W / cv.clientWidth, y: e.offsetY * H / cv.clientHeight });

    function start() { state = 'play'; score = 0; combo = 0; rimY = 190; ends = performance.now() + TIME * 1000; newBall(); ui(); }
    function newBall() { const x = score < 4 ? 150 : 40 + Math.random() * 150; ball = { x, y: FLOOR - R, sx: x, vx: 0, vy: 0, live: false, touched: false, scored: false }; power = 0; }
    function launch(vx, vy) {
      if (state !== 'play' || !ball || ball.live) return;
      const sp = Math.hypot(vx, vy); if (sp < 250) return;
      if (sp > 950) { vx *= 950 / sp; vy *= 950 / sp; }
      Object.assign(ball, { vx, vy, live: true, t0: performance.now() });
    }
    const kbSpeed = () => 450 + power * 450;
    function keyAim(d) { if (state === 'play' && ball && !ball.live) ang = Math.max(0.35, Math.min(1.45, ang + d)); }
    function charge(on) {
      if (state !== 'play') { if (!on) start(); return; }
      if (on) { if (!charging && ball && !ball.live) { charging = true; power = 0; } }
      else if (charging) { charging = false; launch(Math.cos(ang) * kbSpeed(), -Math.sin(ang) * kbSpeed()); }
    }
    // touch/mouse: drag back from anywhere, let go to shoot (like a slingshot)
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); if (state !== 'play') { start(); return; } if (ball && !ball.live) { drag = pos(e); drag.cur = drag; cv.setPointerCapture(e.pointerId); } });
    cv.addEventListener('pointermove', (e) => { if (drag) drag.cur = pos(e); });
    cv.addEventListener('pointerup', () => { if (!drag) return; const v = dragVel(); drag = null; if (v) launch(v.vx, v.vy); });
    const dragVel = () => { if (!drag) return null; const dx = drag.x - drag.cur.x, dy = drag.y - drag.cur.y; return Math.hypot(dx, dy) < 12 ? null : { vx: dx * 5, vy: dy * 5 }; };

    function physics(b, dt) {
      const py = b.y; b.vy += G * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      for (const ex of [rimL(), rimR()]) { // rim ends
        const dx = b.x - ex, dy = b.y - rimY, d = Math.hypot(dx, dy);
        if (d < R + 3 && d > 0) { const nx = dx / d, ny = dy / d, dot = b.vx * nx + b.vy * ny; if (dot < 0) { b.vx -= 1.3 * dot * nx; b.vy -= 1.3 * dot * ny; } b.x = ex + nx * (R + 3); b.y = rimY + ny * (R + 3); b.touched = true; }
      }
      if (b.x > BOARD_X - R && b.y > rimY - 75 && b.y < rimY + 10 && b.vx > 0) { b.x = BOARD_X - R; b.vx = -b.vx * 0.4; b.touched = true; } // backboard
      if (b.y > FLOOR - R) { b.y = FLOOR - R; b.vy = -b.vy * 0.5; b.vx *= 0.8; }
      return py;
    }
    function step(dt, now) {
      if (state !== 'play') return;
      if (now >= ends && (!ball || !ball.live)) { state = 'over'; if (score > best()) store.set('br-best', score); ui(); return; }
      if (score >= 12) { rimY += rimDir * (25 + score * 1.5) * dt; if (rimY > 250) { rimY = 250; rimDir = -1; } if (rimY < 140) { rimY = 140; rimDir = 1; } }
      if (charging) power = Math.min(1, power + dt * 0.6);
      if (!ball || !ball.live) return;
      const py = physics(ball, dt);
      if (!ball.scored && py < rimY && ball.y >= rimY && ball.vy > 0 && ball.x > rimL() + 4 && ball.x < rimR() - 4) {
        ball.scored = true; combo++;
        const far = ball.sx < 110; // long shots count 3
        const pts = ((far ? 3 : 2) + (ball.touched ? 0 : 1)) * (combo >= 3 ? 2 : 1); score += pts;
        flash = `${ball.touched ? '' : 'SWISH '}+${pts}${combo >= 3 ? ' 🔥' : ''}`; flashT = now; ui();
      }
      const slow = Math.abs(ball.vx) < 30 && ball.y >= FLOOR - R - 1;
      if (ball.x < -30 || ball.x > W + 30 || slow || now - ball.t0 > 4000 || (ball.scored && ball.y > rimY + 60)) { if (!ball.scored) combo = 0; newBall(); }
    }
    function preview() { // short dotted guide of the first part of the arc
      let v = null; if (drag) v = dragVel(); else if (state === 'play' && ball && !ball.live) v = { vx: Math.cos(ang) * kbSpeed(), vy: -Math.sin(ang) * kbSpeed() };
      if (!v) return; const b = { x: ball.x, y: ball.y, vx: v.vx, vy: v.vy };
      c.fillStyle = css('--navy');
      for (let i = 0; i < 14; i++) { for (let k = 0; k < 5; k++) { b.vy += G / 120; b.x += b.vx / 120; b.y += b.vy / 120; } c.globalAlpha = 1 - i / 15; c.beginPath(); c.arc(b.x, b.y, 3, 0, 6.3); c.fill(); }
      c.globalAlpha = 1;
    }
    function frame(now) {
      const dt = Math.min(0.033, (now - last) / 1000); last = now; step(dt, now);
      c.fillStyle = css('--paper'); c.fillRect(0, 0, W, H);
      c.fillStyle = css('--rule'); c.fillRect(0, FLOOR, W, H - FLOOR);
      c.strokeStyle = css('--mute'); c.lineWidth = 2; c.setLineDash([4, 6]); c.beginPath(); c.moveTo(110, FLOOR); c.lineTo(110, FLOOR + 30); c.stroke(); c.setLineDash([]);
      c.font = font(600, 12); c.fillStyle = css('--mute'); c.textAlign = 'center'; c.fillText('3PT', 80, FLOOR + 24);
      // pole, board, rim, net
      c.fillStyle = css('--mute'); c.fillRect(BOARD_X + 6, rimY - 40, 6, FLOOR - rimY + 40);
      c.fillStyle = css('--ink'); c.fillRect(BOARD_X, rimY - 80, 6, 90);
      c.strokeStyle = css('--mute'); c.lineWidth = 1.2;
      for (let k = 0; k <= 4; k++) { c.beginPath(); c.moveTo(rimL() + (rimR() - rimL()) * k / 4, rimY); c.lineTo(rimL() + 10 + (rimR() - rimL() - 20) * k / 4, rimY + 30); c.stroke(); }
      c.strokeStyle = '#e07a2e'; c.lineWidth = 4; c.beginPath(); c.moveTo(rimL(), rimY); c.lineTo(BOARD_X, rimY); c.stroke();
      // hud
      c.textAlign = 'left'; c.font = font(700, 18); c.fillStyle = css('--mute');
      const left = state === 'play' ? Math.max(0, Math.ceil((ends - now) / 1000)) : TIME;
      c.fillText(`SCORE ${score}`, 14, 28); c.textAlign = 'center'; c.fillStyle = left <= 5 && state === 'play' ? css('--bad') : css('--mute'); c.fillText(`0:${String(left).padStart(2, '0')}`, W / 2, 28);
      c.textAlign = 'right'; c.fillStyle = css('--mute'); c.fillText(`BEST ${best()}`, W - 14, 28);
      if (ball) { preview(); drawBall(c, ball.x, ball.y, R); }
      if (charging) { c.fillStyle = css('--rule'); c.fillRect(14, 60, 12, 110); c.fillStyle = css('--good'); c.fillRect(14, 170 - power * 110, 12, power * 110); }
      if (flash && now - flashT < 900) centerText(c, flash, 110, font(800, 32), css('--good'));
      if (state === 'play' && score === 0 && ball && !ball.live && !drag) centerText(c, 'Drag back + let go · or ↑ ↓ aim, hold Space', H - 18, font(600, 14), css('--ink'));
      if (state === 'ready') { centerText(c, 'BUZZER RUSH', 250, font(800, 44), css('--ink')); centerText(c, `${TIME} seconds. Swish +1. Behind the line = 3.`, 282, font(600, 17), css('--mute')); centerText(c, '3 in a row = double points', 304, font(600, 17), css('--mute')); centerText(c, 'Tap or press Space to start', 334, font(600, 18), css('--navy')); }
      if (state === 'over') { centerText(c, 'BUZZER!', 240, font(800, 44), css('--ink')); centerText(c, `Score: ${score}  ·  Best: ${best()}`, 274, font(700, 22), css('--ink')); centerText(c, 'Tap or press Space to go again', 304, font(600, 18), css('--navy')); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { start, keyAim, charge, get state() { return state; } };
  }

  // ---------------- wiring ----------------
  window.addEventListener('DOMContentLoaded', () => {
    const hsCv = document.getElementById('hs-canvas'), brCv = document.getElementById('br-canvas');
    if (!hsCv) return;
    const shareBtn = document.getElementById('hs-share');
    const hs = HotStreak(hsCv, () => { shareBtn.hidden = !(hs && hs.mode === 'daily' && hs.state === 'done'); });
    const br = BuzzerRush(brCv, () => {});
    let active = 'hs';
    const pick = document.getElementById('gamepick');
    pick.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      pick.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      const g = b.dataset.g; active = g === 'br' ? 'br' : 'hs';
      document.getElementById('hs-wrap').hidden = active !== 'hs'; document.getElementById('br-wrap').hidden = active !== 'br';
      if (g === 'hs-daily') hs.start('daily'); else if (g === 'hs') hs.start('endless');
      document.getElementById('game-help').textContent = g === 'br' ? 'Phone: drag back and let go, like a slingshot. Keyboard: ↑ ↓ to aim, hold Space for power, let go to shoot.' : g === 'hs-daily' ? 'Same 10 shots for everyone today. One try per day. Swish (dark blue) = 🔥.' : 'Tap the court or press Space when the marker is in the green. It gets faster every make.';
    };
    hsCv.addEventListener('pointerdown', (e) => { e.preventDefault(); hs.shoot(); });
    shareBtn.onclick = async () => {
      const text = hs.shareText();
      if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) {} }
      try { await navigator.clipboard.writeText(text); shareBtn.textContent = 'Copied!'; setTimeout(() => (shareBtn.textContent = 'Share result'), 1500); } catch (e) {}
    };
    const onPlay = () => document.getElementById('play') && document.getElementById('play').classList.contains('on');
    window.addEventListener('keydown', (e) => {
      if (!onPlay() || e.target.closest('input,select,textarea')) return;
      if (active === 'hs' && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); if (!e.repeat) hs.shoot(); }
      if (active === 'br') {
        if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) br.charge(true); }
        if (e.code === 'ArrowUp' || e.code === 'ArrowRight') { e.preventDefault(); br.keyAim(0.04); }
        if (e.code === 'ArrowDown' || e.code === 'ArrowLeft') { e.preventDefault(); br.keyAim(-0.04); }
      }
    });
    window.addEventListener('keyup', (e) => { if (onPlay() && active === 'br' && e.code === 'Space') { e.preventDefault(); br.charge(false); } });
  });
})();
