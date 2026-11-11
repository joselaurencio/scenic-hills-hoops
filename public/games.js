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


  // ---------------- Locker Room: badges, ball skins, play streak ----------------
  const BADGES = {
    hs5: ['Heating Up', 'Hot Streak of 5'], hs10: ['On Fire', 'Hot Streak of 10'], hs20: ['Unconscious', 'Hot Streak of 20'],
    daily7: ['Daily Grinder', '7+ on the Daily'], daily10: ['Perfect Day', '10/10 on the Daily'],
    br20: ['Buzzer Beater', '20+ in Buzzer Rush'], br40: ['Arcade Legend', '40+ in Buzzer Rush'],
    cr500: ['Ankle Breaker', '500 ft in Crossover Rush'], cr1500: ['Untouchable', '1,500 ft in Crossover Rush'],
    tr7: ['Film Room', '7+ on Hoops Trivia'], tr10: ['Hoops Professor', '10/10 on Hoops Trivia'],
    hl10: ['Scout', '10 straight on Higher or Lower'], hl25: ['GM Material', '25 straight on Higher or Lower'],
    days3: ['Gym Rat', 'Played 3 days in a row'], days7: ['Every Day', 'Played 7 days in a row'],
  };
  const SKINS = [
    { id: 'classic', name: 'Classic', fill: '#e07a2e', line: '#7a3a10', need: 0 },
    { id: 'hawks', name: 'Hawks Blue', fill: '#1f5fbf', line: '#0c2a5c', need: 2 },
    { id: 'street', name: 'Streetball', fill: '#c9452c', line: '#5a1a0e', need: 4 },
    { id: 'gold', name: 'Gold', fill: '#e2b13c', line: '#7a5a10', need: 6 },
    { id: 'ice', name: 'Ice', fill: '#9fd6f2', line: '#2c6f93', need: 9 },
    { id: 'galaxy', name: 'Galaxy', fill: '#5b3fa8', line: '#1d0f45', need: 12 },
  ];
  const earned = () => store.get('badges', {});
  let toastEl = null;
  function award(id) {
    const b = earned(); if (b[id] || !BADGES[id]) return;
    b[id] = todayKey(); store.set('badges', b);
    const n = Object.keys(b).length, sk = SKINS.find((x) => x.need === n);
    toast(`🏅 ${BADGES[id][0]}${sk ? ` · ${sk.name} ball unlocked!` : ''}`);
    if (window.__lockerRender) window.__lockerRender();
  }
  function toast(t) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'gtoast'; document.body.appendChild(toastEl); }
    toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastEl._t); toastEl._t = setTimeout(() => toastEl.classList.remove('on'), 2600);
  }
  function markPlayed() { // daily play streak
    const d = store.get('days', { last: '', run: 0, plays: 0 }), t = todayKey();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yk = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    if (d.last !== t) { d.run = d.last === yk ? d.run + 1 : 1; d.last = t; }
    d.plays = (d.plays || 0) + 1; store.set('days', d);
    if (d.run >= 3) award('days3'); if (d.run >= 7) award('days7');
  }
  const skin = () => SKINS.find((x) => x.id === store.get('skin', 'classic')) || SKINS[0];

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
    const k = skin();
    c.fillStyle = k.fill; c.beginPath(); c.arc(x, y, r, 0, 2 * Math.PI); c.fill();
    c.strokeStyle = k.line; c.lineWidth = 1.5;
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
      state = 'aim'; t0 = performance.now(); phase = params(0).phase; markPlayed(); ui();
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
        if (made) { streak++; if (streak > best()) store.set('hs-best', streak); if (streak >= 5) award('hs5'); if (streak >= 10) award('hs10'); if (streak >= 20) award('hs20'); state = 'aim'; }
        else state = 'over';
      } else {
        results.push(shot.kind === 'swish' ? 2 : made ? 1 : 0);
        if (results.length === 10) { state = 'done'; store.set('hs-daily-' + todayKey(), results); const m = results.filter(Boolean).length; if (m >= 7) award('daily7'); if (m === 10) award('daily10'); } else state = 'aim';
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

    function start() { markPlayed(); state = 'play'; score = 0; combo = 0; rimY = 190; ends = performance.now() + TIME * 1000; newBall(); ui(); }
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
      if (now >= ends && (!ball || !ball.live)) { state = 'over'; if (score > best()) store.set('br-best', score); if (score >= 20) award('br20'); if (score >= 40) award('br40'); ui(); return; }
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


  // ---------------- Crossover Rush: dribble up court, dodge defenders ----------------
  function CrossoverRush(cv) {
    const c = setupCanvas(cv);
    const LANES = [W / 2 - 100, W / 2, W / 2 + 100], PY = H - 90;
    let state = 'ready', lane = 1, px = LANES[1], dist = 0, speed = 220, obs = [], coins = 0, spawnT = 0, last = performance.now(), hit = 0;
    const best = () => store.get('cr-best', 0);
    function start() { markPlayed(); state = 'play'; lane = 1; px = LANES[1]; dist = 0; speed = 220; obs = []; coins = 0; spawnT = 0; }
    function move(d) { if (state !== 'play') { start(); return; } lane = Math.max(0, Math.min(2, lane + d)); }
    function over() {
      state = 'over'; const ft = Math.floor(dist / 10) + coins * 25;
      if (ft > best()) store.set('cr-best', ft); if (ft >= 500) award('cr500'); if (ft >= 1500) award('cr1500');
    }
    let sx = null;
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); sx = e.offsetX; if (state !== 'play') start(); });
    cv.addEventListener('pointerup', (e) => {
      if (sx == null || state !== 'play') return; const dx = e.offsetX - sx; sx = null;
      if (Math.abs(dx) > 20) move(dx > 0 ? 1 : -1); else move(e.offsetX < cv.clientWidth / 2 ? -1 : 1); // swipe, or tap a side
    });
    function spawn() {
      const open = Math.floor(Math.random() * 3); // always leave one lane open
      const n = dist > 4000 && Math.random() < 0.45 ? 2 : 1;
      const lanes = [0, 1, 2].filter((l) => l !== open).sort(() => Math.random() - 0.5).slice(0, n);
      lanes.forEach((l) => obs.push({ lane: l, y: -40, kind: 'd', wob: Math.random() * 6 }));
      if (Math.random() < 0.55) obs.push({ lane: open, y: -40, kind: 'c' });
    }
    function frame(now) {
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      if (state === 'play') {
        speed = Math.min(620, speed + dt * 9); dist += speed * dt; spawnT -= dt;
        if (spawnT <= 0) { spawn(); spawnT = Math.max(0.42, 1.05 - dist / 9000); }
        px += (LANES[lane] - px) * Math.min(1, dt * 16);
        for (const o of obs) {
          o.y += speed * dt;
          if (Math.abs(o.y - PY) < 26 && Math.abs(LANES[o.lane] - px) < 34 && !o.done) {
            o.done = true; if (o.kind === 'c') { coins++; } else { hit = now; over(); }
          }
        }
        obs = obs.filter((o) => o.y < H + 40 && !(o.kind === 'c' && o.done));
      }
      // court scrolling
      c.fillStyle = css('--paper'); c.fillRect(0, 0, W, H);
      c.strokeStyle = css('--rule'); c.lineWidth = 2;
      const off = (dist * 0.6) % 80; for (let y = -80 + off; y < H; y += 80) { c.beginPath(); c.moveTo(20, y); c.lineTo(W - 20, y); c.stroke(); }
      c.beginPath(); c.moveTo(W / 2 - 150, 0); c.lineTo(W / 2 - 150, H); c.moveTo(W / 2 + 150, 0); c.lineTo(W / 2 + 150, H); c.stroke();
      for (const o of obs) {
        const x = LANES[o.lane] + (o.kind === 'd' ? Math.sin(now / 200 + o.wob) * 8 : 0);
        if (o.kind === 'd') { // defender: body + arms up
          c.fillStyle = css('--bad'); c.beginPath(); c.arc(x, o.y - 14, 10, 0, 6.3); c.fill(); c.fillRect(x - 13, o.y - 4, 26, 26);
          c.strokeStyle = css('--bad'); c.lineWidth = 5; c.beginPath(); c.moveTo(x - 12, o.y); c.lineTo(x - 24, o.y - 22); c.moveTo(x + 12, o.y); c.lineTo(x + 24, o.y - 22); c.stroke();
        } else { drawBall(c, x, o.y, 9); }
      }
      // player
      c.fillStyle = css('--navy'); c.beginPath(); c.arc(px, PY - 16, 10, 0, 6.3); c.fill(); c.fillRect(px - 12, PY - 6, 24, 26);
      drawBall(c, px + 18, PY + 18 + Math.abs(Math.sin(now / 110)) * -10, 8);
      c.textAlign = 'left'; c.font = font(700, 18); c.fillStyle = css('--mute');
      c.fillText(`${Math.floor(dist / 10) + coins * 25} FT`, 14, 28); c.textAlign = 'right'; c.fillText(`BEST ${best()}`, W - 14, 28);
      if (state === 'ready') { centerText(c, 'CROSSOVER RUSH', 230, font(800, 40), css('--ink')); centerText(c, 'Cross over defenders. Grab loose balls (+25).', 262, font(600, 16), css('--mute')); centerText(c, 'Swipe or tap a side · ← → keys', 286, font(600, 16), css('--mute')); centerText(c, 'Tap or press ← → to start', 318, font(600, 18), css('--navy')); }
      if (state === 'over') { centerText(c, now - hit < 400 ? 'BLOCKED!' : 'CHARGE!', 230, font(800, 44), css('--bad')); centerText(c, `${Math.floor(dist / 10) + coins * 25} ft  ·  Best ${best()}`, 266, font(700, 22), css('--ink')); centerText(c, 'Tap or press ← → to run again', 296, font(600, 18), css('--navy')); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { move };
  }

  // ---------------- Hoops Trivia: the-trivia-api.com basketball questions + Hawks questions from the site's data ----------------
  function Trivia(box) {
    let qs = [], i = 0, score = 0, streak = 0, timer = null, left = 0, locked = false;
    const best = () => store.get('tr-best', 0);
    const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
    function hawksQuestions() { // built from live standings + stats on the page
      const out = [];
      try {
        const T = D.teams, us = T.find((t) => t.name === US), rank = T.slice().sort((a, b) => b.rating - a.rating);
        const div = T.filter((t) => t.division === us.division && t !== us).map((t) => short(t.name));
        const others = T.filter((t) => t.division !== us.division).map((t) => short(t.name));
        if (div.length >= 1 && others.length >= 3) out.push({ q: `Which of these teams is in the Hawks' ${CFG[TEAM].label} division?`, a: div[0], wrong: shuffle(others).slice(0, 3) });
        const top = rank[0]; out.push({ q: `Who is #1 in the ${CFG[TEAM].label} power rankings right now?`, a: short(top.name), wrong: shuffle(rank.slice(1, 8).map((t) => short(t.name))).slice(0, 3) });
        const S = STATS && STATS[TEAM];
        if (S && S.games.length) {
          const tot = {}; S.games.forEach((g) => g.box.forEach((r) => { const pts = r.pts ?? ((r.fg2 || [0])[0] * 2 + (r.fg3 || [0])[0] * 3 + (r.ft || [0])[0]); tot[r.no] = (tot[r.no] || 0) + pts; }));
          const order = Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([no]) => S.players[no]).filter(Boolean);
          if (order.length >= 4) out.push({ q: `Who has scored the most points for the Hawks ${CFG[TEAM].label} this season?`, a: order[0], wrong: order.slice(1, 4) });
          const g = S.games[S.games.length - 1];
          out.push({ q: `How many points did the Hawks score vs ${short(g.opponent)}?`, a: String(g.us), wrong: [g.us - 6, g.us + 4, g.us + 9].map(String) });
        }
      } catch (e) {}
      return out;
    }
    async function load() {
      box.innerHTML = '<p class="small">Loading questions…</p>';
      let api = [];
      try {
        const r = await fetch('https://the-trivia-api.com/v2/questions?limit=30&tags=basketball');
        const j = await r.json();
        api = j.filter((x) => /basketball|nba|dunk|hoop|court/i.test(x.question.text + ' ' + (x.tags || []).join(' ')) && x.category === 'sport_and_leisure')
          .map((x) => ({ q: x.question.text, a: x.correctAnswer, wrong: x.incorrectAnswers }));
      } catch (e) {}
      const local = hawksQuestions();
      qs = shuffle(local.slice(0, 3).concat(shuffle(api))).slice(0, 10);
      if (qs.length < 10) qs = qs.concat(shuffle(FALLBACK).slice(0, 10 - qs.length));
      qs = qs.map((x) => ({ ...x, opts: shuffle([x.a, ...x.wrong.slice(0, 3)]) }));
      i = 0; score = 0; streak = 0; markPlayed(); ask();
    }
    function ask() {
      clearInterval(timer); locked = false;
      if (i >= qs.length) return finish();
      const x = qs[i]; left = 12;
      box.innerHTML = `<div class="tq"><div class="tqh"><span>Question ${i + 1}/10</span><span>Score ${score}${streak >= 2 ? ` · 🔥${streak}` : ''}</span></div>` +
        `<div class="ttimer"><i id="ttbar"></i></div><p class="tqq">${esc(x.q)}</p>` +
        x.opts.map((o, k) => `<button class="topt" data-k="${k}"><b>${k + 1}</b> ${esc(o)}</button>`).join('') + `<p class="small">Tap an answer or press 1–4. Faster answers and streaks score more.</p></div>`;
      box.querySelectorAll('.topt').forEach((b) => (b.onclick = () => answer(+b.dataset.k)));
      const t0 = performance.now();
      timer = setInterval(() => { left = 12 - (performance.now() - t0) / 1000; const bar = document.getElementById('ttbar'); if (bar) bar.style.width = Math.max(0, left / 12 * 100) + '%'; if (left <= 0) answer(-1); }, 100);
    }
    function answer(k) {
      if (locked || i >= qs.length) return; locked = true; clearInterval(timer);
      const x = qs[i], ok = k >= 0 && x.opts[k] === x.a;
      if (ok) { streak++; score += 100 + Math.round(Math.max(0, left) * 10) + (streak >= 3 ? 50 : 0); x.right = true; } else streak = 0;
      box.querySelectorAll('.topt').forEach((b) => { const o = x.opts[+b.dataset.k]; if (o === x.a) b.classList.add('ok'); else if (+b.dataset.k === k) b.classList.add('no'); b.disabled = true; });
      setTimeout(() => { i++; ask(); }, ok ? 700 : 1400);
    }
    function finish() {
      const right = qs.filter((x) => x.right).length;
      if (score > best()) store.set('tr-best', score); if (right >= 7) award('tr7'); if (right === 10) award('tr10');
      box.innerHTML = `<div class="tq"><p class="tqq">${right}/10 right · ${score} points</p><p class="small">Best: ${best()} points</p><div class="cardbtns"><button id="tragain">Play again</button></div></div>`;
      document.getElementById('tragain').onclick = load;
    }
    function key(e) { if (/^Digit[1-4]$/.test(e.code)) answer(+e.code.slice(5) - 1); if (e.code === 'Enter' && box.querySelector('#tragain')) load(); }
    return { start: load, key, stop: () => clearInterval(timer) };
  }
  // used when the trivia API is down or short on questions
  const FALLBACK = [
    { q: 'How many points is a shot from behind the three-point line?', a: '3', wrong: ['2', '4', '1'] },
    { q: 'How many players per team are on the court in a basketball game?', a: '5', wrong: ['6', '4', '7'] },
    { q: 'What is it called when a player moves without dribbling?', a: 'Traveling', wrong: ['Goaltending', 'Charging', 'Double team'] },
    { q: 'How long is the shot clock in the NBA?', a: '24 seconds', wrong: ['30 seconds', '35 seconds', '20 seconds'] },
    { q: 'Who invented basketball in 1891?', a: 'James Naismith', wrong: ['Abner Doubleday', 'Walter Camp', 'William Morgan'] },
    { q: 'How high is a regulation basketball rim?', a: '10 feet', wrong: ['9 feet', '11 feet', '12 feet'] },
    { q: 'What is a "double-double"?', a: '10+ in two stat categories', wrong: ['Two dunks in a row', 'Two fouls in one play', 'Scoring 22 points'] },
    { q: 'How many personal fouls before fouling out in high school basketball?', a: '5', wrong: ['6', '4', '3'] },
    { q: 'What is it called when a shot hits only the net?', a: 'Swish', wrong: ['Brick', 'Airball', 'Bank shot'] },
    { q: 'What is an "and-one"?', a: 'A made basket plus a free throw from a foul', wrong: ['One free throw for a technical', 'A one-point shot', 'A single overtime'] },
    { q: 'How many quarters are in a high school basketball game?', a: '4', wrong: ['2', '3', '5'] },
    { q: 'What does a referee signal with both arms raised after a made shot?', a: 'A three-pointer', wrong: ['A timeout', 'Traveling', 'A jump ball'] },
  ];

  // ---------------- Higher or Lower: live league teams ----------------
  function HigherLower(box) {
    let a = null, b = null, streak = 0, stat = null;
    const best = () => store.get('hl-best', 0);
    const STATS_HL = [
      { k: 'rating', lab: 'power rating', fmt: (t) => (t.rating > 0 ? '+' : '') + t.rating.toFixed(1) },
      { k: 'pf', lab: 'points scored this season', fmt: (t) => t.pf },
      { k: 'w', lab: 'wins this season', fmt: (t) => t.w },
      { k: 'odds', lab: 'playoff odds', fmt: (t) => Math.round(t.odds.playoffs * 100) + '%', v: (t) => t.odds.playoffs },
    ];
    const val = (t) => (stat.v ? stat.v(t) : t[stat.k]);
    function pick() {
      const T = (typeof D !== 'undefined' && D) ? D.teams : [];
      if (T.length < 2) { box.innerHTML = '<p class="small">League data is still loading…</p>'; return false; }
      stat = STATS_HL[Math.floor(Math.random() * STATS_HL.length)];
      for (let n = 0; n < 50; n++) { b = T[Math.floor(Math.random() * T.length)]; if (b !== a && (!a || val(b) !== val(a))) break; }
      return true;
    }
    function start() { a = null; streak = 0; markPlayed(); const T = D.teams; a = T[Math.floor(Math.random() * T.length)]; if (pick()) render(); }
    function render(reveal, ok) {
      box.innerHTML = `<div class="tq"><div class="tqh"><span>Streak ${streak}</span><span>Best ${best()}</span></div>` +
        `<p class="tqq">Which team has more <b>${stat.lab}</b>?</p><div class="hlrow">` +
        [a, b].map((t, k) => `<button class="hlcard${reveal ? (val(t) >= val(k ? a : b) ? ' ok' : ' no') : ''}" data-k="${k}"><span class="small">Div ${t.division.slice(-1)} · ${t.w}-${t.l}</span><b>${esc(short(t.name))}</b><em>${reveal ? stat.fmt(t) : '?'}</em></button>`).join('<span class="hlvs">vs</span>') +
        `</div><p class="small">${reveal ? (ok ? 'Correct!' : `Streak over at ${streak}.`) : 'Tap a team or press ← / →.'}</p>${reveal && !ok ? '<div class="cardbtns"><button id="hlagain">Play again</button></div>' : ''}</div>`;
      if (!reveal) box.querySelectorAll('.hlcard').forEach((c) => (c.onclick = () => guess(+c.dataset.k)));
      const again = document.getElementById('hlagain'); if (again) again.onclick = start;
    }
    let busy = false;
    function guess(k) {
      if (busy) return; busy = true;
      const pickT = k ? b : a, other = k ? a : b, ok = val(pickT) >= val(other);
      if (ok) { streak++; if (streak > best()) store.set('hl-best', streak); if (streak >= 10) award('hl10'); if (streak >= 25) award('hl25'); }
      render(true, ok);
      setTimeout(() => { busy = false; if (ok) { a = b; if (pick()) render(); } }, ok ? 900 : 0);
    }
    function key(e) { if (e.code === 'ArrowLeft') guess(0); if (e.code === 'ArrowRight') guess(1); if (e.code === 'Enter' && document.getElementById('hlagain')) start(); }
    return { start, key };
  }

  // ---------------- Locker Room ----------------
  function Locker(box) {
    function render() {
      const b = earned(), n = Object.keys(b).length, d = store.get('days', { run: 0, plays: 0 }), cur = store.get('skin', 'classic');
      const bests = [['Hot Streak', store.get('hs-best', 0)], ['Buzzer Rush', store.get('br-best', 0)], ['Crossover Rush', store.get('cr-best', 0) + ' ft'], ['Hoops Trivia', store.get('tr-best', 0)], ['Higher or Lower', store.get('hl-best', 0)]];
      box.innerHTML = `<div class="facts"><div><span>Badges</span><b>${n}/${Object.keys(BADGES).length}</b></div><div><span>Day streak</span><b>${d.run || 0} 🔥</b></div><div><span>Games played</span><b>${d.plays || 0}</b></div><div><span>Ball</span><b style="font-size:22px">${esc((SKINS.find((x) => x.id === cur) || SKINS[0]).name)}</b></div></div>` +
        `<h3>Personal bests</h3><table>${bests.map(([g, v]) => `<tr><td>${g}</td><td class="n"><b>${v}</b></td></tr>`).join('')}</table>` +
        `<h3>Ball skins</h3><p class="small">Earn badges to unlock new balls. They show up in every game.</p><div class="skins">` +
        SKINS.map((k) => { const open = n >= k.need; return `<button class="skin${k.id === cur ? ' on' : ''}" data-s="${k.id}" ${open ? '' : 'disabled'}><i style="background:${k.fill};border-color:${k.line}"></i>${esc(k.name)}<span class="small">${open ? (k.id === cur ? 'Equipped' : 'Tap to use') : `🔒 ${k.need} badges`}</span></button>`; }).join('') + '</div>' +
        `<h3>Badges</h3><div class="badges">` + Object.entries(BADGES).map(([id, [nm, how]]) => `<div class="badge${b[id] ? ' got' : ''}"><b>${b[id] ? '🏅' : '🔒'} ${esc(nm)}</b><span class="small">${esc(how)}</span></div>`).join('') + '</div>';
      box.querySelectorAll('.skin:not([disabled])').forEach((x) => (x.onclick = () => { store.set('skin', x.dataset.s); render(); }));
    }
    window.__lockerRender = render;
    return { start: render };
  }

  // ---------------- wiring ----------------
  window.addEventListener('DOMContentLoaded', () => {
    const hsCv = document.getElementById('hs-canvas');
    if (!hsCv) return;
    const shareBtn = document.getElementById('hs-share');
    const hs = HotStreak(hsCv, () => { shareBtn.hidden = !(hs && hs.mode === 'daily' && hs.state === 'done'); });
    const br = BuzzerRush(document.getElementById('br-canvas'), () => {});
    const cr = CrossoverRush(document.getElementById('cr-canvas'));
    const tr = Trivia(document.getElementById('tr-box'));
    const hl = HigherLower(document.getElementById('hl-box'));
    const lk = Locker(document.getElementById('lk-box'));
    const HELP = {
      hs: 'Tap the court or press Space when the marker is in the green. It gets faster every make.',
      'hs-daily': 'Same 10 shots for everyone today. One try per day. Swish (dark blue) = 🔥.',
      br: 'Phone: drag back and let go, like a slingshot. Keyboard: ↑ ↓ to aim, hold Space for power, let go to shoot.',
      cr: 'Swipe or tap left/right to cross over. Keyboard: ← →. Don\'t run into a defender.',
      tr: 'Basketball trivia from the-trivia-api.com plus Hawks questions from this site. Tap or press 1–4.',
      hl: 'Pick the team with the higher number. Uses live league data. Tap or press ← / →.',
      lk: 'Your badges, personal bests, play streak and ball skins (saved on this device).',
    };
    const WRAP = { hs: 'hs-wrap', 'hs-daily': 'hs-wrap', br: 'br-wrap', cr: 'cr-wrap', tr: 'tr-wrap', hl: 'hl-wrap', lk: 'lk-wrap' };
    let active = 'hs';
    const pick = document.getElementById('gamepick');
    function choose(g) {
      active = g; tr.stop();
      pick.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.g === g));
      Object.values(WRAP).forEach((id) => (document.getElementById(id).hidden = id !== WRAP[g]));
      document.getElementById('game-help').textContent = HELP[g];
      if (g === 'hs-daily') hs.start('daily'); else if (g === 'hs') hs.start('endless');
      else if (g === 'tr') tr.start(); else if (g === 'hl') hl.start(); else if (g === 'lk') lk.start();
    }
    pick.onclick = (e) => { const b = e.target.closest('button'); if (b) choose(b.dataset.g); };
    hsCv.addEventListener('pointerdown', (e) => { e.preventDefault(); hs.shoot(); });
    shareBtn.onclick = async () => {
      const text = hs.shareText();
      if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) {} }
      try { await navigator.clipboard.writeText(text); shareBtn.textContent = 'Copied!'; setTimeout(() => (shareBtn.textContent = 'Share result'), 1500); } catch (e) {}
    };
    const onPlay = () => document.getElementById('play').classList.contains('on');
    window.addEventListener('keydown', (e) => {
      if (!onPlay() || (e.target.closest && e.target.closest('input,select,textarea'))) return;
      const arrows = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
      if ((active === 'hs' || active === 'hs-daily') && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); if (!e.repeat) hs.shoot(); }
      if (active === 'br') {
        if (arrows.includes(e.code)) e.preventDefault();
        if (e.code === 'Space' && !e.repeat) br.charge(true);
        if (e.code === 'ArrowUp' || e.code === 'ArrowRight') br.keyAim(0.04);
        if (e.code === 'ArrowDown' || e.code === 'ArrowLeft') br.keyAim(-0.04);
      }
      if (active === 'cr' && !e.repeat) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); cr.move(-1); } if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); cr.move(1); } }
      if (active === 'tr' && !e.repeat) tr.key(e);
      if (active === 'hl' && !e.repeat) { if (e.code.startsWith('Arrow')) e.preventDefault(); hl.key(e); }
    });
    window.addEventListener('keyup', (e) => { if (onPlay() && active === 'br' && e.code === 'Space') { e.preventDefault(); br.charge(false); } });
  });
})();
