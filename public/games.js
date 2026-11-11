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
    trSudden: ['Ice Veins', '10 straight in Sudden Death'], trSpeed: ['Speed Reader', '15 in a Speed Round'],
    rb50: ['Glass Cleaner', '50 boards in Rebound Reflex'], fb40: ['Floor General', '40 in Fast Break'],
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

  // ---------------- shared team leaderboard (Vercel function, used by both copies of the site) ----------------
  const LB_API = 'https://scenic-hills-hoops.vercel.app/api/scores';
  const LB = {
    pending: {},
    panels: {},
    attach(el, game) { el.dataset.game = game; this.panels[game] = el; this.render(el); },
    report(game, score) { if (score > 0) { this.pending[game] = score; const el = this.panels[game]; if (el) this.render(el); } },
    async render(el) {
      const game = el.dataset.game, me = store.get('lb-name', ''), sc = this.pending[game];
      el.innerHTML = `<h3>Team leaderboard</h3><div class="lbform"></div><ol class="lblist"><li class="small">Loading…</li></ol>`;
      if (sc) {
        const f = el.querySelector('.lbform');
        f.innerHTML = `<p>You scored <b>${sc}</b>. Post it:</p><div class="lbrow"><input maxlength="16" placeholder="Your name" value="${esc(me)}"><button>Post</button></div><p class="small lbmsg"></p>`;
        f.querySelector('button').onclick = async () => {
          const name = f.querySelector('input').value.trim(); if (!name) return;
          store.set('lb-name', name); f.querySelector('.lbmsg').textContent = 'Posting…';
          try {
            const r = await fetch(LB_API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ game, name, score: sc }) });
            const j = await r.json(); if (!r.ok) throw j.error || r.status;
            delete this.pending[game]; this.draw(el, j.top, name, j.kept ? 'Your best score is already higher.' : '');
          } catch (e) { f.querySelector('.lbmsg').textContent = "Couldn't post: " + e; }
        };
      }
      try { const j = await (await fetch(`${LB_API}?game=${encodeURIComponent(game)}`)).json(); if (el.dataset.game === game) this.draw(el, j.top || [], me, ''); }
      catch (e) { el.querySelector('.lblist').innerHTML = '<li class="small">Leaderboard is offline right now.</li>'; }
    },
    draw(el, top, me, msg) {
      if (!this.pending[el.dataset.game]) el.querySelector('.lbform').innerHTML = msg ? `<p class="small">${msg}</p>` : '';
      el.querySelector('.lblist').innerHTML = top.length ? top.slice(0, 10).map((r, i) => `<li class="${me && r.name.toLowerCase() === me.toLowerCase() ? 'me' : ''}"><span>${['🥇', '🥈', '🥉'][i] || i + 1}</span><b>${esc(r.name)}</b><em>${r.score}</em></li>`).join('') : '<li class="small">No scores yet. Be the first!</li>';
    },
  };

  // power-up balls: drawn with a glowing ring and an icon
  function drawPower(c, x, y, r, p, now) {
    c.save(); c.globalAlpha = 0.35 + 0.25 * Math.sin(now / 120); c.fillStyle = p.color; c.beginPath(); c.arc(x, y, r + 7, 0, 6.3); c.fill(); c.restore();
    c.fillStyle = p.color; c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill();
    c.font = `${Math.round(r * 1.2)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.icon, x, y + 1); c.textBaseline = 'alphabetic';
  }
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

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
    let fx = { wide: 0, slow: 0, save: 0 }; // power-ups earned every 5 makes
    const HS_POWERS = [{ k: 'wide', n: 3, icon: '↔️', label: 'WIDE ZONE x3', color: '#2f9e6b' }, { k: 'slow', n: 3, icon: '⏳', label: 'SLOW METER x3', color: '#3fa7c4' }, { k: 'save', n: 1, icon: '🛟', label: 'SECOND CHANCE', color: '#e2b13c' }];
    const best = () => store.get('hs-best', 0);

    function params(i) { // meter speed + green-zone width for shot i
      if (mode === 'daily') return daily[i];
      return { speed: (1.5 + 0.2 * i) * (fx.slow ? 0.6 : 1), zone: Math.min(0.5, Math.max(0.05, 0.3 - 0.02 * i) * (fx.wide ? 1.8 : 1)), phase: Math.random() * 6.28 };
    }
    function buildDaily() {
      const r = rng('hawks-' + todayKey());
      daily = Array.from({ length: 10 }, (_, i) => ({ speed: 1.6 + i * 0.22 + r() * 0.6, zone: Math.max(0.06, 0.26 - i * 0.017 - r() * 0.03), phase: r() * 6.28 }));
    }
    function shotIndex() { return mode === 'daily' ? results.length : streak; }
    function meterPos(now) { const p = params(shotIndex()); return 0.5 + 0.5 * Math.sin(phase + ((now - t0) / 1000) * p.speed * Math.PI); }

    function start(m) {
      mode = m; streak = 0; results = []; shot = null; flash = ''; fx = { wide: 0, slow: 0, save: 0 };
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
        if (fx.wide) fx.wide--; if (fx.slow) fx.slow--;
        if (!made && fx.save) { fx.save = 0; flash = 'SAVED 🛟'; state = 'aim'; }
        else if (made) { streak++; if (streak % 5 === 0) { const pw = pickOne(HS_POWERS); fx[pw.k] = pw.n; flash = pw.icon + ' ' + pw.label; } if (streak > best()) store.set('hs-best', streak); if (streak >= 5) award('hs5'); if (streak >= 10) award('hs10'); if (streak >= 20) award('hs20'); state = 'aim'; }
        else { state = 'over'; LB.report('hotstreak', streak); }
      } else {
        results.push(shot.kind === 'swish' ? 2 : made ? 1 : 0);
        if (results.length === 10) { state = 'done'; store.set('hs-daily-' + todayKey(), results); const m = results.filter(Boolean).length; LB.report('daily-' + todayKey(), results.reduce((a, x) => a + x, 0)); if (m >= 7) award('daily7'); if (m === 10) award('daily10'); } else state = 'aim';
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
      if (mode === 'endless' && state !== 'ready') { // active power-ups
        let x = 14; c.font = '15px sans-serif'; c.textAlign = 'left';
        HS_POWERS.forEach((pw) => { if (fx[pw.k]) { c.fillText(`${pw.icon}${pw.n > 1 ? fx[pw.k] : ''}`, x, 52); x += 40; } });
      }
      // meter
      if (state === 'aim' || state === 'flying') {
        const z = params(shotIndex()).zone, mx = 30, mw = W - 60, my = H - 52;
        c.fillStyle = css('--rule'); c.fillRect(mx, my, mw, 16);
        c.fillStyle = css('--good'); c.fillRect(mx + mw * (0.5 - z / 2), my, mw * z, 16);
        c.fillStyle = css('--navy'); c.fillRect(mx + mw * (0.5 - z / 8), my, mw * z / 4, 16);
        if (state === 'aim') { const p = meterPos(now); c.fillStyle = css('--ink'); c.fillRect(mx + mw * p - 2, my - 6, 4, 28); }
        c.font = font(600, 14); c.fillStyle = css('--mute'); c.textAlign = 'center'; c.fillText('TAP / SPACE TO SHOOT', W / 2, H - 14);
      }
      if (flash && state === 'aim') centerText(c, flash, HY + 90, font(800, flash.length > 8 ? 26 : 34), flash === 'CLANK' ? css('--bad') : css('--good'));
      if (state === 'ready') { centerText(c, 'HOT STREAK', 250, font(800, 44), css('--ink')); centerText(c, 'Stop the meter in the green. Power-up every 5.', 282, font(600, 18), css('--mute')); centerText(c, 'Tap or press Space to start', 310, font(600, 18), css('--navy')); }
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
    let ang = 0.95, power = 0, charging = false, drag = null, last = performance.now(), wideUntil = 0, shots = 0;
    const BR_POWERS = [{ k: 'gold', icon: '⭐', color: '#e2b13c', label: 'GOLD BALL x3' }, { k: 'clock', icon: '⏱️', color: '#3fa7c4', label: '+5 SECONDS' }, { k: 'wide', icon: '🔥', color: '#c9452c', label: 'BIG RIM 10s' }];
    const rimL = () => BOARD_X - (performance.now() < wideUntil ? 112 : 84), rimR = () => BOARD_X - 8;
    const best = () => store.get('br-best', 0);
    const pos = (e) => ({ x: e.offsetX * W / cv.clientWidth, y: e.offsetY * H / cv.clientHeight });

    function start() { markPlayed(); state = 'play'; score = 0; combo = 0; rimY = 190; wideUntil = 0; shots = 0; ends = performance.now() + TIME * 1000; newBall(); ui(); }
    function newBall() { const x = score < 4 ? 150 : 40 + Math.random() * 150; shots++; ball = { x, y: FLOOR - R, sx: x, vx: 0, vy: 0, live: false, touched: false, scored: false, pw: shots > 2 && Math.random() < 0.22 ? pickOne(BR_POWERS) : null }; power = 0; }
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
      if (now >= ends && (!ball || !ball.live)) { state = 'over'; if (score > best()) store.set('br-best', score); LB.report('buzzer', score); if (score >= 20) award('br20'); if (score >= 40) award('br40'); ui(); return; }
      if (score >= 12) { rimY += rimDir * (25 + score * 1.5) * dt; if (rimY > 250) { rimY = 250; rimDir = -1; } if (rimY < 140) { rimY = 140; rimDir = 1; } }
      if (charging) power = Math.min(1, power + dt * 0.6);
      if (!ball || !ball.live) return;
      const py = physics(ball, dt);
      if (!ball.scored && py < rimY && ball.y >= rimY && ball.vy > 0 && ball.x > rimL() + 4 && ball.x < rimR() - 4) {
        ball.scored = true; combo++;
        const far = ball.sx < 110; // long shots count 3
        const pw = ball.pw;
        const pts = ((far ? 3 : 2) + (ball.touched ? 0 : 1)) * (combo >= 3 ? 2 : 1) * (pw && pw.k === 'gold' ? 3 : 1); score += pts;
        if (pw && pw.k === 'clock') ends += 5000; if (pw && pw.k === 'wide') wideUntil = now + 10000;
        flash = pw ? `${pw.icon} ${pw.k === 'gold' ? '+' + pts : pw.label}` : `${ball.touched ? '' : 'SWISH '}+${pts}${combo >= 3 ? ' 🔥' : ''}`; flashT = now; ui();
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
      if (ball) { preview(); if (ball.pw) drawPower(c, ball.x, ball.y, R, ball.pw, now); else drawBall(c, ball.x, ball.y, R); }
      if (ball && ball.pw && !ball.live && state === 'play') centerText(c, `${ball.pw.icon} ${ball.pw.label} if you make it`, 70, font(700, 16), css('--navy'));
      if (charging) { c.fillStyle = css('--rule'); c.fillRect(14, 60, 12, 110); c.fillStyle = css('--good'); c.fillRect(14, 170 - power * 110, 12, power * 110); }
      if (flash && now - flashT < 900) centerText(c, flash, 110, font(800, 32), css('--good'));
      if (state === 'play' && score === 0 && ball && !ball.live && !drag) centerText(c, 'Drag back + let go · or ↑ ↓ aim, hold Space', H - 18, font(600, 14), css('--ink'));
      if (state === 'ready') { centerText(c, 'BUZZER RUSH', 250, font(800, 44), css('--ink')); centerText(c, `${TIME} seconds. Swish +1. Behind the line = 3.`, 282, font(600, 17), css('--mute')); centerText(c, '3 in a row = double. Glowing balls = power-ups.', 304, font(600, 17), css('--mute')); centerText(c, 'Tap or press Space to start', 334, font(600, 18), css('--navy')); }
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
    let state = 'ready', lane = 1, px = LANES[1], dist = 0, speed = 220, obs = [], coins = 0, spawnT = 0, last = performance.now(), hit = 0, pts = 0;
    const fx = {}; // power-up -> expires at
    const CR_POWERS = [{ k: 'shield', icon: '🛡️', color: '#1f5fbf', label: 'SHIELD', ms: 12000 }, { k: 'slow', icon: '⏳', color: '#3fa7c4', label: 'SLOW-MO', ms: 5000 }, { k: 'magnet', icon: '🧲', color: '#c2417a', label: 'MAGNET', ms: 7000 }, { k: 'x2', icon: '✖️', color: '#e2b13c', label: 'DOUBLE POINTS', ms: 8000 }];
    const on = (k) => (fx[k] || 0) > performance.now();
    let banner = '', bannerT = 0;
    const best = () => store.get('cr-best', 0);
    function start() { markPlayed(); state = 'play'; lane = 1; px = LANES[1]; dist = 0; speed = 220; obs = []; coins = 0; spawnT = 0; pts = 0; for (const k in fx) delete fx[k]; }
    function move(d) { if (state !== 'play') { start(); return; } lane = Math.max(0, Math.min(2, lane + d)); }
    function over() {
      state = 'over'; const ft = Math.floor(pts);
      if (ft > best()) store.set('cr-best', ft); LB.report('crossover', ft); if (ft >= 500) award('cr500'); if (ft >= 1500) award('cr1500');
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
      if (Math.random() < 0.13) obs.push({ lane: open, y: -40, kind: 'p', pw: pickOne(CR_POWERS) });
      else if (Math.random() < 0.55) obs.push({ lane: open, y: -40, kind: 'c' });
    }
    function frame(now) {
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      if (state === 'play') {
        speed = Math.min(620, speed + dt * 9); const v = speed * (on('slow') ? 0.55 : 1); dist += v * dt; pts += v * dt / 10 * (on('x2') ? 2 : 1); spawnT -= dt * (on('slow') ? 0.55 : 1);
        if (spawnT <= 0) { spawn(); spawnT = Math.max(0.42, 1.05 - dist / 9000); }
        px += (LANES[lane] - px) * Math.min(1, dt * 16);
        for (const o of obs) {
          o.y += v * dt;
          if (o.kind === 'c' && on('magnet') && o.y > PY - 220 && !o.done) o.lane = lane; // magnet pulls loose balls into your lane
          if (Math.abs(o.y - PY) < 26 && Math.abs(LANES[o.lane] - px) < 34 && !o.done) {
            o.done = true;
            if (o.kind === 'c') { coins++; pts += 25 * (on('x2') ? 2 : 1); }
            else if (o.kind === 'p') { fx[o.pw.k] = now + o.pw.ms; banner = `${o.pw.icon} ${o.pw.label}`; bannerT = now; }
            else if (on('shield')) { fx.shield = 0; banner = '🛡️ BLOCKED THE BLOCK'; bannerT = now; }
            else { hit = now; over(); }
          }
        }
        obs = obs.filter((o) => o.y < H + 40 && !(o.kind !== 'd' && o.done));
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
        } else if (o.kind === 'p') { drawPower(c, x, o.y, 11, o.pw, now); } else { drawBall(c, x, o.y, 9); }
      }
      // player
      if (on('shield')) { c.strokeStyle = '#1f5fbf'; c.lineWidth = 3; c.beginPath(); c.arc(px, PY, 32, 0, 6.3); c.stroke(); }
      c.fillStyle = css('--navy'); c.beginPath(); c.arc(px, PY - 16, 10, 0, 6.3); c.fill(); c.fillRect(px - 12, PY - 6, 24, 26);
      drawBall(c, px + 18, PY + 18 + Math.abs(Math.sin(now / 110)) * -10, 8);
      c.textAlign = 'left'; c.font = font(700, 18); c.fillStyle = css('--mute');
      c.fillText(`${Math.floor(pts)} FT`, 14, 28); c.textAlign = 'right'; c.fillText(`BEST ${best()}`, W - 14, 28);
      if (state === 'play') { let x = 14; c.font = '15px sans-serif'; c.textAlign = 'left'; CR_POWERS.forEach((p) => { if (on(p.k)) { c.fillText(`${p.icon}${Math.ceil((fx[p.k] - now) / 1000)}`, x, 52); x += 46; } }); }
      if (banner && now - bannerT < 1100) centerText(c, banner, 140, font(800, 26), css('--navy'));
      if (state === 'ready') { centerText(c, 'CROSSOVER RUSH', 230, font(800, 40), css('--ink')); centerText(c, 'Dodge defenders. Loose balls +25. Glowing = power-up.', 262, font(600, 16), css('--mute')); centerText(c, 'Swipe or tap a side · ← → keys', 286, font(600, 16), css('--mute')); centerText(c, 'Tap or press ← → to start', 318, font(600, 18), css('--navy')); }
      if (state === 'over') { centerText(c, now - hit < 400 ? 'BLOCKED!' : 'CHARGE!', 230, font(800, 44), css('--bad')); centerText(c, `${Math.floor(pts)} ft  ·  Best ${best()}`, 266, font(700, 22), css('--ink')); centerText(c, 'Tap or press ← → to run again', 296, font(600, 18), css('--navy')); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { move };
  }

  // ---------------- Hoops Trivia: modes, the-trivia-api.com questions + Hawks questions from this site ----------------
  const TRIVIA_MODES = {
    classic: { name: 'Classic', desc: '10 questions, 12 seconds each. Fast answers and streaks score more.' },
    sudden: { name: 'Sudden Death', desc: 'Keep going until you miss one. 10 seconds each.' },
    speed: { name: 'Speed Round', desc: 'As many as you can in 60 seconds. Misses cost 3 seconds.' },
    hawks: { name: 'Hawks Only', desc: 'Questions about our teams, built from this site\'s live stats and standings.' },
    daily: { name: 'Daily', desc: 'The same 7 questions for everyone today. One try.' },
  };
  function Trivia(box) {
    let mode = 'classic', qs = [], i = 0, score = 0, right = 0, streak = 0, timer = null, left = 0, locked = false, endAt = 0, pool = [], usedApi = new Set();
    const shuffle = (a, r = Math.random) => a.map((x) => [r(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
    const lbId = () => (mode === 'daily' ? 'trivia-daily-' + todayKey() : 'trivia-' + mode);
    const bestKey = () => 'tr-best-' + mode;

    function menu() {
      clearInterval(timer);
      const doneToday = store.get('tr-daily-' + todayKey(), null);
      box.innerHTML = `<div class="tq"><p class="tqq">Pick a mode</p>` + Object.entries(TRIVIA_MODES).map(([k, m]) =>
        `<button class="topt tmode" data-m="${k}"><b>${m.name}</b><span class="small">${k === 'daily' && doneToday != null ? `Done today: ${doneToday} pts` : m.desc} · best ${store.get('tr-best-' + k, 0)}</span></button>`).join('') + '</div>';
      box.querySelectorAll('.tmode').forEach((b) => (b.onclick = () => start(b.dataset.m)));
      if (window.__lbTrivia) window.__lbTrivia(lbId());
    }

    function hawksQuestions(r = Math.random) { // generated from the live data on the page, for whichever team is selected
      const out = [], add = (q, a, wrong) => { wrong = [...new Set(wrong.map(String).filter((w) => w && w !== String(a)))]; if (wrong.length >= 3) out.push({ q, a: String(a), wrong: wrong.slice(0, 3), tag: 'hawks' }); };
      try {
        const lab = CFG[TEAM].label, T = D.teams, us = T.find((t) => t.name === US), rank = T.slice().sort((a, b) => b.rating - a.rating);
        const nm = (t) => short(t.name), divT = T.filter((t) => t.division === us.division && t !== us), others = T.filter((t) => t.division !== us.division);
        if (divT.length) add(`Which team is in the Hawks ${lab} division?`, nm(shuffle(divT, r)[0]), shuffle(others, r).map(nm));
        add(`Who is #1 in the ${lab} power rankings right now?`, nm(rank[0]), rank.slice(1, 8).map(nm));
        add(`What is the Hawks ${lab} record right now?`, `${us.w}-${us.l}`, [`${us.w + 1}-${us.l}`, `${us.w}-${us.l + 1}`, `${Math.max(0, us.w - 1)}-${us.l + 1}`, `${us.l}-${us.w + 2}`]);
        const rk = rank.indexOf(us) + 1; add(`Where do the Hawks ${lab} rank in the power rankings (out of ${T.length})?`, `#${rk}`, [rk + 2, rk + 5, Math.max(1, rk - 2) === rk ? rk + 7 : Math.max(1, rk - 2), rk + 9].map((x) => '#' + x));
        const next = us.games.find((g) => g.us === null); if (next) add(`Who do the Hawks ${lab} play next?`, short(next.opponent), shuffle(T.filter((t) => t !== us && t.name !== next.opponent), r).map(nm));
        const lastG = us.games.filter((g) => g.us !== null).pop(); if (lastG) add(`What was the score of the Hawks ${lab}' last game vs ${short(lastG.opponent)}?`, `${lastG.us}-${lastG.them}`, [`${lastG.us - 5}-${lastG.them}`, `${lastG.us}-${lastG.them + 7}`, `${lastG.them}-${lastG.us}`, `${lastG.us + 4}-${lastG.them + 2}`]);
        const S = STATS && STATS[TEAM];
        if (S && S.games.length) {
          const tot = {}, ast = {};
          S.games.forEach((g) => g.box.forEach((x) => { const pts = x.pts ?? ((x.fg2 || [0])[0] * 2 + (x.fg3 || [0])[0] * 3 + (x.ft || [0])[0]); tot[x.no] = (tot[x.no] || 0) + pts; ast[x.no] = (ast[x.no] || 0) + (x.ast || 0); }));
          const byPts = Object.keys(tot).sort((a, b) => tot[b] - tot[a]).filter((n) => S.players[n]);
          if (byPts.length >= 4) add(`Who leads the Hawks ${lab} in points this season?`, S.players[byPts[0]], byPts.slice(1).map((n) => S.players[n]));
          const byAst = Object.keys(ast).sort((a, b) => ast[b] - ast[a]).filter((n) => S.players[n] && ast[n] > 0);
          if (byAst.length && byPts.length >= 4) add(`Who leads the Hawks ${lab} in assists?`, S.players[byAst[0]], byPts.filter((n) => n !== byAst[0]).map((n) => S.players[n]));
          const nums = Object.keys(S.players);
          shuffle(nums, r).slice(0, 3).forEach((n) => add(`What number does ${S.players[n]} wear?`, `#${n}`, shuffle(nums.filter((x) => x !== n), r).map((x) => '#' + x)));
          S.games.forEach((g) => { const b = g.box.slice().sort((a, c) => (c.pts ?? 0) - (a.pts ?? 0))[0]; const pts = (x) => x.pts ?? ((x.fg2 || [0])[0] * 2 + (x.fg3 || [0])[0] * 3 + (x.ft || [0])[0]); const top = g.box.slice().sort((a, c) => pts(c) - pts(a))[0]; if (top && S.players[top.no]) add(`Who led the Hawks in scoring vs ${short(g.opponent)}?`, S.players[top.no], g.box.filter((x) => x !== top && S.players[x.no]).map((x) => S.players[x.no])); });
        }
      } catch (e) {}
      return shuffle(out, r);
    }
    async function apiPool() {
      if (pool.length >= 15) return pool;
      try {
        const j = await (await fetch('https://the-trivia-api.com/v2/questions?limit=50&tags=basketball')).json();
        j.filter((x) => x.category === 'sport_and_leisure' && /basketball|nba|dunk|hoop|court|wnba|ncaa/i.test(x.question.text + ' ' + (x.tags || []).join(' ')) && !usedApi.has(x.id))
          .forEach((x) => { usedApi.add(x.id); pool.push({ q: x.question.text, a: x.correctAnswer, wrong: x.incorrectAnswers, diff: x.difficulty }); });
      } catch (e) {}
      return pool;
    }
    const prep = (list) => list.map((x) => ({ ...x, opts: shuffle([x.a, ...x.wrong.slice(0, 3)]) }));

    async function start(m) {
      mode = m; i = 0; score = 0; right = 0; streak = 0; clearInterval(timer);
      if (window.__lbTrivia) window.__lbTrivia(lbId());
      if (m === 'daily' && store.get('tr-daily-' + todayKey(), null) != null) { menu(); return; }
      box.innerHTML = '<p class="small">Loading questions…</p>';
      if (m === 'hawks') qs = hawksQuestions();
      else if (m === 'daily') { const r = rng('trivia-' + todayKey()); qs = shuffle(hawksQuestions(r).slice(0, 2).concat(shuffle(BANK, r).slice(0, 5)), r); }
      else { const api = await apiPool(); qs = shuffle(hawksQuestions().slice(0, 2).concat(api.splice(0, 30), shuffle(BANK))); }
      const seen = new Set(); qs = qs.filter((x) => !seen.has(x.q) && seen.add(x.q));
      if (m === 'classic') qs = qs.slice(0, 10); if (m === 'daily') qs = qs.slice(0, 7);
      if (m === 'hawks' && qs.length < 5) qs = qs.concat(shuffle(BANK).slice(0, 10 - qs.length));
      if (m === 'hawks') qs = qs.slice(0, 10);
      qs = prep(qs); markPlayed();
      if (m === 'speed') { endAt = performance.now() + 60000; timer = setInterval(tickSpeed, 100); }
      ask();
    }
    function tickSpeed() { const l = (endAt - performance.now()) / 1000, bar = document.getElementById('ttbar'); if (bar) bar.style.width = Math.max(0, l / 60 * 100) + '%'; const t = document.getElementById('ttl'); if (t) t.textContent = Math.max(0, Math.ceil(l)) + 's'; if (l <= 0) finish(); }
    function ask() {
      if (mode !== 'speed') clearInterval(timer);
      locked = false;
      if (i >= qs.length) { if (mode === 'sudden' || mode === 'speed') { qs = qs.concat(prep(shuffle(BANK))); } else return finish(); }
      const x = qs[i], per = mode === 'sudden' ? 10 : 12, total = mode === 'classic' || mode === 'hawks' || mode === 'daily' ? qs.length : null;
      box.innerHTML = `<div class="tq"><div class="tqh"><span>${TRIVIA_MODES[mode].name} · ${total ? `Q ${i + 1}/${total}` : `#${i + 1}`}${mode === 'speed' ? ' · <span id="ttl"></span>' : ''}</span><span>${mode === 'sudden' || mode === 'speed' ? `${right} right` : `${score} pts`}${streak >= 2 ? ` · 🔥${streak}` : ''}</span></div>` +
        `<div class="ttimer"><i id="ttbar"></i></div><p class="tqq">${esc(x.q)}${x.tag === 'hawks' ? ' <span class="tag in">Hawks</span>' : x.diff === 'hard' ? ' <span class="tag bub">Hard</span>' : ''}</p>` +
        x.opts.map((o, k) => `<button class="topt" data-k="${k}"><b>${k + 1}</b> ${esc(o)}</button>`).join('') + `<p class="small">Tap an answer or press 1–4.</p></div>`;
      box.querySelectorAll('.topt').forEach((b) => (b.onclick = () => answer(+b.dataset.k)));
      if (mode !== 'speed') {
        const t0 = performance.now();
        timer = setInterval(() => { left = per - (performance.now() - t0) / 1000; const bar = document.getElementById('ttbar'); if (bar) bar.style.width = Math.max(0, left / per * 100) + '%'; if (left <= 0) answer(-1); }, 100);
      } else tickSpeed();
    }
    function answer(k) {
      if (locked) return; locked = true; if (mode !== 'speed') clearInterval(timer);
      const x = qs[i], ok = k >= 0 && x.opts[k] === x.a;
      if (ok) { streak++; right++; score += 100 + Math.round(Math.max(0, left) * 10) + (streak >= 3 ? 50 : 0) + (x.diff === 'hard' ? 50 : 0); }
      else { streak = 0; if (mode === 'speed') endAt -= 3000; }
      box.querySelectorAll('.topt').forEach((b) => { const o = x.opts[+b.dataset.k]; if (o === x.a) b.classList.add('ok'); else if (+b.dataset.k === k) b.classList.add('no'); b.disabled = true; });
      if (!ok && mode === 'sudden') return setTimeout(finish, 1300);
      setTimeout(() => { i++; if (mode === 'speed' && performance.now() >= endAt) return finish(); ask(); }, ok ? (mode === 'speed' ? 250 : 650) : (mode === 'speed' ? 700 : 1400));
    }
    function finish() {
      clearInterval(timer); if (box.querySelector('#tragain')) return;
      const val = mode === 'sudden' || mode === 'speed' ? right : score;
      if (val > store.get(bestKey(), 0)) store.set(bestKey(), val);
      if (mode === 'daily') store.set('tr-daily-' + todayKey(), val);
      if (mode === 'classic' || mode === 'hawks') { if (right >= 7) award('tr7'); if (right === qs.length && qs.length >= 10) award('tr10'); }
      if (mode === 'sudden' && right >= 10) award('trSudden'); if (mode === 'speed' && right >= 15) award('trSpeed');
      LB.report(lbId(), val);
      box.innerHTML = `<div class="tq"><p class="tqq">${TRIVIA_MODES[mode].name}: ${mode === 'sudden' || mode === 'speed' ? `${right} right` : `${right}/${qs.length} right · ${score} pts`}</p><p class="small">Best: ${store.get(bestKey(), 0)}</p><div class="cardbtns">${mode === 'daily' ? '' : '<button id="tragain">Play again</button>'}<button id="trmenu">Modes</button></div></div>`;
      const ag = document.getElementById('tragain'); if (ag) ag.onclick = () => start(mode);
      document.getElementById('trmenu').onclick = menu;
    }
    function key(e) { if (/^Digit[1-4]$/.test(e.code)) answer(+e.code.slice(5) - 1); if (e.code === 'Enter' && box.querySelector('#tragain')) start(mode); }
    return { start: menu, key, stop: () => clearInterval(timer), get lb() { return lbId(); } };
  }
  // offline question bank (also used for Daily so everyone gets the same questions)
  const BANK = [
    ['How many points is a shot from behind the three-point line?', '3', '2', '4', '1'],
    ['How many players per team are on the court?', '5', '6', '4', '7'],
    ['What is it called when a player moves without dribbling?', 'Traveling', 'Goaltending', 'Charging', 'A carry'],
    ['How long is the NBA shot clock?', '24 seconds', '30 seconds', '35 seconds', '20 seconds'],
    ['Who invented basketball in 1891?', 'James Naismith', 'Abner Doubleday', 'Walter Camp', 'William Morgan'],
    ['How high is a regulation rim?', '10 feet', '9 feet', '11 feet', '12 feet'],
    ['What is a "double-double"?', '10+ in two stat categories', 'Two dunks in a row', 'Two fouls on one play', 'Scoring 22 points'],
    ['How many fouls before fouling out in high school basketball?', '5', '6', '4', '3'],
    ['What do you call a shot that only touches the net?', 'Swish', 'Brick', 'Airball', 'Bank shot'],
    ['What is an "and-one"?', 'A made basket plus a free throw', 'One technical free throw', 'A one-point shot', 'One overtime'],
    ['How many quarters are in a high school game?', '4', '2', '3', '5'],
    ['What does a ref signal with both arms raised after a make?', 'A three-pointer', 'A timeout', 'Traveling', 'A jump ball'],
    ['What is a shot that misses the rim and backboard completely?', 'Airball', 'Brick', 'Rainbow', 'Floater'],
    ['How long is a high school quarter in Texas?', '8 minutes', '10 minutes', '12 minutes', '6 minutes'],
    ['Which position usually brings the ball up the court?', 'Point guard', 'Center', 'Power forward', 'Small forward'],
    ['What is a "triple-double"?', '10+ in three stat categories', 'Three 3-pointers in a row', 'Three straight wins', 'Scoring 33 points'],
    ['How far is the free-throw line from the backboard?', '15 feet', '12 feet', '18 feet', '20 feet'],
    ['What violation is touching a ball on its way down to the rim?', 'Goaltending', 'Traveling', 'Backcourt', 'Kicking'],
    ['How long can an offensive player stay in the lane?', '3 seconds', '5 seconds', '8 seconds', '10 seconds'],
    ['What is it called when the ball goes back over half court after crossing it?', 'Backcourt violation', 'Over and back pass', 'Three seconds', 'Double dribble'],
    ['A charge is called on which player?', 'The offensive player', 'The defender', 'Both players', 'The coach'],
    ['What is a "screen" (or pick)?', 'Blocking a defender to free a teammate', 'A blocked shot', 'A bounce pass', 'A free throw routine'],
    ['What does "boxing out" help you get?', 'Rebounds', 'Steals', 'Free throws', 'Timeouts'],
    ['What is a shot banked off the backboard called?', 'Bank shot', 'Hook shot', 'Fadeaway', 'Floater'],
    ['How many free throws for a foul on a missed 3-point shot?', '3', '2', '1', '4'],
    ['What is a turnover?', 'Losing the ball to the other team', 'A missed free throw', 'A timeout', 'A jump ball'],
    ['In a 2-3 zone, how many players are near the basket?', '3', '2', '4', '5'],
    ['What is a "fast break"?', 'Pushing the ball up before the defense sets', 'A quick timeout', 'A short halftime', 'A foul on a dunk'],
    ['What is a "crossover"?', 'Switching the dribble hand to beat a defender', 'Passing across the court', 'Changing defenses', 'A jump ball'],
    ['Which stat does an "assist" count?', 'A pass that leads to a basket', 'A blocked shot', 'A rebound', 'A free throw'],
    ['What is it called when a player dribbles, stops, then dribbles again?', 'Double dribble', 'Traveling', 'Carrying', 'Backcourt'],
    ['How many timeouts does a high school team usually get per game?', '5', '3', '7', '10'],
    ['What is the "paint"?', 'The lane near the basket', 'The half-court line', 'The bench area', 'The scorer\'s table'],
    ['What is an "alley-oop"?', 'Catching a lob and scoring in the air', 'A long 3-pointer', 'A no-look pass', 'A spin move'],
    ['What is "man-to-man" defense?', 'Each defender guards one player', 'Defenders guard areas', 'Two players guard one', 'No defense'],
    ['What does "and-1" mean on a stat sheet?', 'Fouled while making the shot', 'One assist', 'One rebound', 'One steal'],
    ['What is a "put-back"?', 'Scoring right after an offensive rebound', 'Passing back to the guard', 'A held ball', 'A foul shot'],
    ['How many points is a free throw worth?', '1', '2', '3', '0.5'],
    ['What is a "technical foul" usually for?', 'Unsportsmanlike conduct', 'Traveling', 'Reaching in', 'A charge'],
    ['What size ball do high school boys use?', 'Size 7 (29.5")', 'Size 6 (28.5")', 'Size 5 (27.5")', 'Size 8'],
    ['What size ball do high school girls use?', 'Size 6 (28.5")', 'Size 7 (29.5")', 'Size 5 (27.5")', 'Size 4'],
    ['What is a "jump ball" used for?', 'Starting the game', 'Ending a quarter', 'Choosing sides', 'Shooting free throws'],
  ].map(([q, a, ...wrong]) => ({ q, a, wrong }));

  // ---------------- Rebound Reflex: catch the misses ----------------
  function ReboundReflex(cv) {
    const c = setupCanvas(cv);
    const RB_POWERS = [{ k: 'hands', icon: '🧤', color: '#2f9e6b', label: 'BIG HANDS', ms: 8000 }, { k: 'slow', icon: '⏳', color: '#3fa7c4', label: 'SLOW-MO', ms: 6000 }, { k: 'life', icon: '❤️', color: '#c2417a', label: '+1 LIFE', ms: 0 }, { k: 'x2', icon: '✖️', color: '#e2b13c', label: 'DOUBLE POINTS', ms: 8000 }];
    let state = 'ready', px = W / 2, target = W / 2, balls = [], score = 0, lives = 3, combo = 0, spawnT = 0, last = performance.now(), t = 0, banner = '', bannerT = 0;
    const fx = {}, on = (k) => (fx[k] || 0) > performance.now(), keys = { l: false, r: false };
    const best = () => store.get('rb-best', 0);
    function start() { markPlayed(); state = 'play'; px = target = W / 2; balls = []; score = 0; lives = 3; combo = 0; spawnT = 0.6; t = 0; for (const k in fx) delete fx[k]; }
    function spawn() {
      const pw = t > 6 && Math.random() < 0.12 ? pickOne(RB_POWERS) : null;
      balls.push({ x: W / 2 + (Math.random() - 0.5) * 40, y: 120, vx: (Math.random() - 0.5) * (160 + t * 6), vy: -120 - Math.random() * 160, pw });
    }
    const pos = (e) => e.offsetX * W / cv.clientWidth;
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); if (state !== 'play') { start(); return; } target = pos(e); cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (state === 'play' && e.buttons) target = pos(e); });
    function frame(now) {
      const dt0 = Math.min(0.033, (now - last) / 1000); last = now;
      if (state === 'play') {
        const dt = dt0 * (on('slow') ? 0.55 : 1); t += dt0;
        if (keys.l) target = px - 400 * dt0; if (keys.r) target = px + 400 * dt0;
        target = Math.max(30, Math.min(W - 30, target)); px += (target - px) * Math.min(1, dt0 * 18);
        spawnT -= dt; if (spawnT <= 0) { spawn(); spawnT = Math.max(0.45, 1.4 - t / 40); }
        const half = on('hands') ? 48 : 30, g = 420 + t * 4;
        for (const b of balls) {
          b.vy += g * dt; b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.x < 14 || b.x > W - 14) { b.vx = -b.vx; b.x = Math.max(14, Math.min(W - 14, b.x)); }
          if (!b.done && b.y > H - 78 && b.y < H - 52 && Math.abs(b.x - px) < half && b.vy > 0) {
            b.done = true;
            if (b.pw) { if (b.pw.k === 'life') lives = Math.min(5, lives + 1); else fx[b.pw.k] = now + b.pw.ms; banner = `${b.pw.icon} ${b.pw.label}`; bannerT = now; }
            else { combo++; score += (1 + Math.floor(combo / 10)) * (on('x2') ? 2 : 1); }
          }
          if (!b.done && b.y > H + 20) { b.done = true; if (!b.pw) { lives--; combo = 0; banner = 'MISSED'; bannerT = now; if (lives <= 0) { state = 'over'; if (score > best()) store.set('rb-best', score); LB.report('rebound', score); if (score >= 50) award('rb50'); } } }
        }
        balls = balls.filter((b) => !b.done);
      }
      // draw: backboard + rim up top, player at bottom
      c.fillStyle = css('--paper'); c.fillRect(0, 0, W, H);
      c.fillStyle = css('--ink'); c.fillRect(W / 2 - 46, 60, 92, 6); c.strokeStyle = '#e07a2e'; c.lineWidth = 4; c.beginPath(); c.moveTo(W / 2 - 27, 112); c.lineTo(W / 2 + 27, 112); c.stroke();
      c.fillStyle = css('--rule'); c.fillRect(0, H - 40, W, 40);
      for (const b of balls) { if (b.pw) drawPower(c, b.x, b.y, 12, b.pw, now); else drawBall(c, b.x, b.y, 12); }
      const half = on('hands') ? 48 : 30;
      c.fillStyle = css('--navy'); c.fillRect(px - half, H - 62, half * 2, 10); c.beginPath(); c.arc(px, H - 76, 10, 0, 6.3); c.fill(); c.fillRect(px - 10, H - 66, 20, 26);
      c.textAlign = 'left'; c.font = font(700, 18); c.fillStyle = css('--mute'); c.fillText(`BOARDS ${score}`, 14, 28);
      c.textAlign = 'center'; c.fillText('❤️'.repeat(Math.max(0, lives)), W / 2, 28); c.textAlign = 'right'; c.fillText(`BEST ${best()}`, W - 14, 28);
      if (state === 'play') { let x = 14; c.font = '15px sans-serif'; c.textAlign = 'left'; RB_POWERS.forEach((p) => { if (p.ms && on(p.k)) { c.fillText(`${p.icon}${Math.ceil((fx[p.k] - now) / 1000)}`, x, 52); x += 46; } }); if (combo >= 10) centerText(c, `COMBO ${combo}`, 160, font(800, 22), css('--good')); }
      if (banner && now - bannerT < 900 && state === 'play') centerText(c, banner, 200, font(800, 26), banner === 'MISSED' ? css('--bad') : css('--navy'));
      if (state === 'ready') { centerText(c, 'REBOUND REFLEX', 240, font(800, 40), css('--ink')); centerText(c, 'Catch every miss. 3 drops and you\'re out.', 272, font(600, 16), css('--mute')); centerText(c, 'Drag or ← → to move. Glowing = power-up.', 294, font(600, 16), css('--mute')); centerText(c, 'Tap or press ← → to start', 326, font(600, 18), css('--navy')); }
      if (state === 'over') { centerText(c, 'OUT OF BOUNDS', 240, font(800, 38), css('--bad')); centerText(c, `${score} boards  ·  Best ${best()}`, 274, font(700, 22), css('--ink')); centerText(c, 'Tap or press ← → to play again', 304, font(600, 18), css('--navy')); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { key(e, down) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keys.l = down; if (down && state !== 'play') start(); } if (e.code === 'ArrowRight' || e.code === 'KeyD') { keys.r = down; if (down && state !== 'play') start(); } } };
  }

  // ---------------- Fast Break: hit the open teammate before the defense recovers ----------------
  function FastBreak(cv) {
    const c = setupCanvas(cv);
    const SPOTS = [[60, 150], [300, 150], [180, 110], [70, 300], [290, 300]];
    let state = 'ready', open = -1, gold = false, openUntil = 0, nextAt = 0, score = 0, assists = 0, tos = 0, window_ = 1500, last = 0, banner = '', bannerT = 0, hotUntil = 0;
    const best = () => store.get('fb-best', 0);
    function start() { markPlayed(); state = 'play'; score = 0; assists = 0; tos = 0; window_ = 1500; open = -1; nextAt = performance.now() + 700; hotUntil = 0; }
    function turnover(now, why) { tos++; banner = why; bannerT = now; open = -1; nextAt = now + 800; if (tos >= 3) { state = 'over'; if (score > best()) store.set('fb-best', score); LB.report('fastbreak', score); if (score >= 40) award('fb40'); } }
    function pass(k) {
      const now = performance.now();
      if (state !== 'play') { start(); return; }
      if (open < 0) return;
      if (k === open) {
        assists++; const hot = now < hotUntil; score += (gold ? 3 : 1) * (hot ? 2 : 1);
        banner = gold ? '⭐ +3' : hot ? '🔥 +2' : 'DIME!'; bannerT = now;
        if (gold && Math.random() < 0.5) { hotUntil = now + 6000; banner = '🔥 HOT HAND 6s'; }
        open = -1; window_ = Math.max(420, window_ * 0.95); nextAt = now + 250 + Math.random() * 500;
      } else turnover(now, 'PICKED OFF');
    }
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); const x = e.offsetX * W / cv.clientWidth, y = e.offsetY * H / cv.clientHeight;
      if (state !== 'play') { start(); return; }
      let bestK = -1, bd = 70; SPOTS.forEach(([sx, sy], k) => { const d = Math.hypot(x - sx, y - sy); if (d < bd) { bd = d; bestK = k; } });
      if (bestK >= 0) pass(bestK);
    });
    function frame(now) {
      if (state === 'play') {
        if (open < 0 && now >= nextAt) { open = Math.floor(Math.random() * 5); gold = Math.random() < 0.15; openUntil = now + window_ * (gold ? 0.8 : 1); }
        if (open >= 0 && now > openUntil) turnover(now, 'TOO SLOW');
      }
      c.fillStyle = css('--paper'); c.fillRect(0, 0, W, H);
      c.strokeStyle = css('--rule'); c.lineWidth = 2; c.beginPath(); c.arc(W / 2, 60, 210, 0, Math.PI); c.stroke(); c.strokeRect(W / 2 - 60, 0, 120, 190);
      c.fillStyle = css('--ink'); c.fillRect(W / 2 - 30, 20, 60, 5);
      SPOTS.forEach(([x, y], k) => {
        const isOpen = k === open;
        if (isOpen) { const frac = Math.max(0, (openUntil - now) / window_); c.strokeStyle = gold ? '#e2b13c' : css('--good'); c.lineWidth = 5; c.beginPath(); c.arc(x, y, 34, -Math.PI / 2, -Math.PI / 2 + frac * 6.28); c.stroke(); }
        c.fillStyle = isOpen ? (gold ? '#e2b13c' : css('--good')) : css('--navy'); c.beginPath(); c.arc(x, y - 10, 10, 0, 6.3); c.fill(); c.fillRect(x - 11, y, 22, 24);
        if (!isOpen && state === 'play') { c.fillStyle = css('--bad'); c.globalAlpha = 0.85; c.fillRect(x + 12, y - 6, 16, 26); c.beginPath(); c.arc(x + 20, y - 14, 8, 0, 6.3); c.fill(); c.globalAlpha = 1; }
        c.font = font(700, 14); c.fillStyle = css('--mute'); c.textAlign = 'center'; c.fillText(String(k + 1), x, y + 42);
      });
      drawBall(c, W / 2, H - 70, 13); c.fillStyle = css('--navy'); c.beginPath(); c.arc(W / 2, H - 100, 10, 0, 6.3); c.fill();
      c.textAlign = 'left'; c.font = font(700, 18); c.fillStyle = css('--mute'); c.fillText(`SCORE ${score}`, 14, H - 16);
      c.textAlign = 'center'; c.fillText('🏀'.repeat(3 - tos) + '⭕'.repeat(tos), W / 2, H - 16); c.textAlign = 'right'; c.fillText(`BEST ${best()}`, W - 14, H - 16);
      if (now < hotUntil && state === 'play') centerText(c, `🔥 HOT HAND ${Math.ceil((hotUntil - now) / 1000)}`, 380, font(800, 20), css('--bad'));
      if (banner && now - bannerT < 800 && state === 'play') centerText(c, banner, 230, font(800, 30), /TOO|PICKED/.test(banner) ? css('--bad') : css('--good'));
      if (state === 'ready') { centerText(c, 'FAST BREAK', 230, font(800, 44), css('--ink')); centerText(c, 'Pass to the open teammate (green) fast.', 262, font(600, 16), css('--mute')); centerText(c, 'Gold = +3 and maybe a hot hand. 3 turnovers = out.', 284, font(600, 15), css('--mute')); centerText(c, 'Tap or press 1–5 to start', 316, font(600, 18), css('--navy')); }
      if (state === 'over') { centerText(c, 'TURNOVER CITY', 240, font(800, 38), css('--bad')); centerText(c, `${score} pts · ${assists} assists · Best ${best()}`, 274, font(700, 20), css('--ink')); centerText(c, 'Tap or press 1–5 to run it back', 304, font(600, 18), css('--navy')); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { key(e) { if (/^Digit[1-5]$/.test(e.code)) pass(+e.code.slice(5) - 1); } };
  }

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
      if (ok) { streak++; if (streak > best()) store.set('hl-best', streak); if (streak >= 10) award('hl10'); if (streak >= 25) award('hl25'); } else LB.report('higherlower', streak);
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
      const bests = [['Hot Streak', store.get('hs-best', 0)], ['Buzzer Rush', store.get('br-best', 0)], ['Crossover Rush', store.get('cr-best', 0) + ' ft'], ['Rebound Reflex', store.get('rb-best', 0)], ['Fast Break', store.get('fb-best', 0)], ['Trivia (Classic)', store.get('tr-best-classic', 0)], ['Trivia (Sudden Death)', store.get('tr-best-sudden', 0)], ['Higher or Lower', store.get('hl-best', 0)]];
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
    const rb = ReboundReflex(document.getElementById('rb-canvas'));
    const fb = FastBreak(document.getElementById('fb-canvas'));
    const tr = Trivia(document.getElementById('tr-box'));
    const hl = HigherLower(document.getElementById('hl-box'));
    const lk = Locker(document.getElementById('lk-box'));
    const lbEl = document.getElementById('lb-panel');
    window.__lbTrivia = (id) => { if (active === 'tr') LB.attach(lbEl, id); };
    const G = {
      hs: { wrap: 'hs-wrap', lb: 'hotstreak', help: 'Tap or press Space when the marker is in the green. Every 5 makes you get a power-up: wide zone, slow meter or a second chance.' },
      'hs-daily': { wrap: 'hs-wrap', lb: () => 'daily-' + todayKey(), help: 'Same 10 shots for everyone today. One try per day. Swish = 2 pts, make = 1. No power-ups, so it\'s fair.' },
      br: { wrap: 'br-wrap', lb: 'buzzer', help: 'Phone: drag back and let go. Keyboard: ↑ ↓ aim, hold Space for power. Glowing balls: ⭐ x3 points, ⏱️ +5 seconds, 🔥 bigger rim.' },
      cr: { wrap: 'cr-wrap', lb: 'crossover', help: 'Swipe or tap a side (← →). Power-ups: 🛡️ shield, ⏳ slow-mo, 🧲 magnet, ✖️ double points.' },
      rb: { wrap: 'rb-wrap', lb: 'rebound', help: 'Drag or hold ← → to catch every miss. Power-ups: 🧤 big hands, ⏳ slow-mo, ❤️ extra life, ✖️ double points.' },
      fb: { wrap: 'fb-wrap', lb: 'fastbreak', help: 'Tap the open (green) teammate or press 1–5 before the defense recovers. Gold teammates are worth 3 and can give you a hot hand.' },
      tr: { wrap: 'tr-wrap', lb: () => tr.lb, help: 'Pick a mode. Questions come from the-trivia-api.com plus Hawks questions built from this site\'s stats.' },
      hl: { wrap: 'hl-wrap', lb: 'higherlower', help: 'Pick the team with the higher number, using live league data. Tap or press ← / →.' },
      lk: { wrap: 'lk-wrap', lb: null, help: 'Your badges, personal bests, day streak and ball skins (saved on this device).' },
    };
    let active = 'hs';
    const pick = document.getElementById('gamepick');
    function choose(g) {
      active = g; tr.stop();
      pick.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.g === g));
      const want = G[g].wrap; Object.values(G).forEach((x) => (document.getElementById(x.wrap).hidden = x.wrap !== want));
      document.getElementById('game-help').textContent = G[g].help;
      if (g === 'hs-daily') hs.start('daily'); else if (g === 'hs') hs.start('endless');
      else if (g === 'tr') tr.start(); else if (g === 'hl') hl.start(); else if (g === 'lk') lk.start();
      const id = typeof G[g].lb === 'function' ? G[g].lb() : G[g].lb;
      lbEl.hidden = !id; if (id) LB.attach(lbEl, id);
    }
    pick.onclick = (e) => { const b = e.target.closest('button'); if (b) choose(b.dataset.g); };
    LB.attach(lbEl, 'hotstreak');
    hsCv.addEventListener('pointerdown', (e) => { e.preventDefault(); hs.shoot(); });
    shareBtn.onclick = async () => {
      const text = hs.shareText();
      if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) {} }
      try { await navigator.clipboard.writeText(text); shareBtn.textContent = 'Copied!'; setTimeout(() => (shareBtn.textContent = 'Share result'), 1500); } catch (e) {}
    };
    const onPlay = () => document.getElementById('play').classList.contains('on');
    const typing = (e) => e.target.closest && e.target.closest('input,select,textarea');
    window.addEventListener('keydown', (e) => {
      if (!onPlay() || typing(e)) return;
      const arrows = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
      if ((active === 'hs' || active === 'hs-daily') && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); if (!e.repeat) hs.shoot(); }
      if (active === 'br') {
        if (arrows.includes(e.code)) e.preventDefault();
        if (e.code === 'Space' && !e.repeat) br.charge(true);
        if (e.code === 'ArrowUp' || e.code === 'ArrowRight') br.keyAim(0.04);
        if (e.code === 'ArrowDown' || e.code === 'ArrowLeft') br.keyAim(-0.04);
      }
      if (active === 'cr' && !e.repeat) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); cr.move(-1); } if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); cr.move(1); } }
      if (active === 'rb') { if (arrows.includes(e.code)) e.preventDefault(); rb.key(e, true); }
      if (active === 'fb' && !e.repeat) fb.key(e);
      if (active === 'tr' && !e.repeat) tr.key(e);
      if (active === 'hl' && !e.repeat) { if (e.code.startsWith('Arrow')) e.preventDefault(); hl.key(e); }
    });
    window.addEventListener('keyup', (e) => {
      if (!onPlay()) return;
      if (active === 'br' && e.code === 'Space') { e.preventDefault(); br.charge(false); }
      if (active === 'rb') rb.key(e, false);
    });
  });
})();
