// builds league data (standings, power ratings, playoff odds) for one team's league from texascharter.org
const TEAMS = {
  vb: { label: 'Varsity Boys', divs: ['sabkbvb1', 'sabkbvb2', 'sabkbvb3', 'sabkbvb4', 'sabkbvb5'], prior: require('./_prior'), unknown: -2 },
  jvg: { label: 'JV Girls', divs: ['sabkbjvg1', 'sabkbjvg2'], prior: require('./_prior_jvg'), unknown: 0 },
};

const AJAX = 'https://texascharter.org/wp-admin/admin-ajax.php';
const SEASON = '26-27';
const UA = { 'user-agent': 'Mozilla/5.0 scenic-hills-hoops' };

const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;|&#0?38;/g, '&').replace(/&#0?39;|&rsquo;|&#8217;/g, "'").replace(/\s+/g, ' ').trim();
const clean = (title) => title.replace(/^\d\d-\d\d /, '').replace(/ (Varsity|JV) (Boys|Girls) Basketball$/, '');
const slugify = (title) => title.toLowerCase().replace(/[&.']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function getNonce() {
  const html = await (await fetch('https://texascharter.org/athletics/basketball/', { headers: UA })).text();
  return html.match(/"nonce":"([^"]+)"/)[1];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// texascharter.org sometimes answers with an error; retry a few times with a fresh nonce
async function divisionTeams(nonce, division) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      if (attempt) { await sleep(1500 * attempt); nonce = await getNonce(); }
      const body = new URLSearchParams({ action: 'tc_schedule_team_options', nonce, division, season: SEASON });
      const json = await (await fetch(AJAX, { method: 'POST', body, headers: UA })).json();
      if (json && json.data && Array.isArray(json.data.teams)) return json.data.teams.map((t) => ({ id: t.id, title: t.title, name: clean(t.title), division }));
    } catch (e) { /* retry */ }
  }
  throw new Error(`texascharter.org gave no team list for ${division}`);
}

async function scrapeTeam(team) {
  const url = `https://texascharter.org/tc_team/${slugify(team.title)}/`;
  const html = await (await fetch(url, { headers: UA })).text();
  const body = (html.match(/<table class="tc-schedule-list">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/) || [])[1] || '';
  const games = [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) => {
    const tds = [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    const home = strip(tds[1] || '') === 'Home';
    const score = strip(tds[4] || '').match(/^(\d+)\s*-\s*(\d+)$/); // listed home - away
    return {
      date: strip((tds[0].match(/tc-schedule-day">([^<]*)/) || [])[1] || ''),
      time: strip((tds[0].match(/tc-schedule-time">([^<]*)/) || [])[1] || ''),
      home,
      opponent: clean(strip(tds[2] || '')),
      venue: strip((tds[3].match(/tc-venue-name">([^<]*)/) || [])[1] || ''),
      us: score ? +score[home ? 1 : 2] : null,
      them: score ? +score[home ? 2 : 1] : null,
    };
  });
  return { ...team, url, games };
}

// prior strength in points vs. an average SA team, from last season
function priorRating(p, unknown) {
  if (!p) return unknown; // new program / no data
  if (p.manual != null) return p.manual; // hand-set
  if (p.rating != null) return p.rating + 8; // MaxPreps TCSAAL scale, SA teams average about -8
  const [w, l] = (p.rec || '').split('-').map(Number);
  if (isNaN(w)) return 0;
  const g = w + l;
  return g ? ((w / g - 0.5) * 16 * g) / (g + 6) : 0;
}

// margin-based rating (SRS-style) blended with last season as ~3 games of evidence
function powerRatings(teams, cfg) {
  const byName = Object.fromEntries(teams.map((t) => [t.name, t]));
  for (const t of teams) {
    t.prior = priorRating(cfg.prior[t.name], cfg.unknown);
    t.rating = t.prior;
  }
  for (let iter = 0; iter < 50; iter++) {
    const next = {};
    for (const t of teams) {
      const played = t.games.filter((g) => g.us !== null);
      let sum = t.prior * 3;
      for (const g of played) {
        const opp = byName[g.opponent];
        const margin = Math.max(-25, Math.min(25, g.us - g.them)); // cap blowouts
        sum += margin + (opp ? opp.rating : -5);
      }
      next[t.name] = sum / (played.length + 3);
    }
    for (const t of teams) t.rating = next[t.name];
  }
}

const winProb = (a, b) => 1 / (1 + Math.exp(-(a - b) / 7));

// simulate the rest of the regular season + the 10-team area bracket
function simulate(teams, DIVS, runs = 4000) {
  const byName = Object.fromEntries(teams.map((t) => [t.name, t]));
  const remaining = [];
  const seen = new Set();
  for (const t of teams) {
    for (const g of t.games) {
      const opp = byName[g.opponent];
      if (g.us !== null || !opp || opp.division !== t.division) continue;
      const key = [t.name, opp.name, g.date].sort().join('|');
      if (!seen.has(key)) { seen.add(key); remaining.push([t, opp]); }
    }
  }
  const tally = Object.fromEntries(teams.map((t) => [t.name, { top2: 0, first: 0, area: 0 }]));
  for (let r = 0; r < runs; r++) {
    const w = Object.fromEntries(teams.map((t) => [t.name, t.dw]));
    const l = Object.fromEntries(teams.map((t) => [t.name, t.dl]));
    for (const [a, b] of remaining) {
      if (Math.random() < winProb(a.rating, b.rating)) { w[a.name]++; l[b.name]++; } else { w[b.name]++; l[a.name]++; }
    }
    const firsts = [], seconds = [];
    for (const d of DIVS) {
      const div = teams.filter((t) => t.division === d)
        .sort((a, b) => (w[b.name] - l[b.name]) - (w[a.name] - l[a.name]) || b.rating - a.rating + (Math.random() - 0.5) * 4);
      if (!div.length) continue;
      tally[div[0].name].first++; tally[div[0].name].top2++; firsts.push(div[0]);
      if (div[1]) { tally[div[1].name].top2++; seconds.push(div[1]); }
    }
    // seeds 1-5 = division winners, 6-10 = runners-up; 7v10 & 8v9 play in, then 8-team bracket
    const rank = (arr) => arr.sort((a, b) => (w[b.name] - l[b.name]) - (w[a.name] - l[a.name]) || b.rating - a.rating);
    const seeds = [...rank(firsts), ...rank(seconds)];
    const play = (a, b) => (!a ? b : !b ? a : Math.random() < winProb(a.rating, b.rating) ? a : b);
    const s = (i) => seeds[i - 1];
    let champ;
    if (DIVS.length === 2) {
      // 4-team bracket: each division winner plays the other division's runner-up
      const [f1, f2] = firsts;
      const r1 = seconds.find((t) => t.division !== f1.division), r2 = seconds.find((t) => t.division !== f2.division);
      champ = play(play(f1, r1), play(f2, r2));
    } else {
      const q1 = play(s(1), play(s(8), s(9))), q2 = play(s(4), s(5)), q3 = play(s(3), s(6)), q4 = play(s(2), play(s(7), s(10)));
      champ = play(play(q1, q2), play(q3, q4));
    }
    if (champ) tally[champ.name].area++;
  }
  for (const t of teams) {
    t.odds = {
      playoffs: tally[t.name].top2 / runs,
      divTitle: tally[t.name].first / runs,
      areaTitle: tally[t.name].area / runs,
    };
  }
}

// hard clinch/elimination from the math alone (ties count as alive)
function status(teams, DIVS) {
  for (const d of DIVS) {
    const div = teams.filter((t) => t.division === d);
    for (const t of div) {
      const maxW = (x) => x.dw + x.divLeft;
      const ahead = div.filter((o) => o !== t && o.dw > maxW(t)).length;
      const canCatch = div.filter((o) => o !== t && maxW(o) >= t.dw).length;
      t.status = ahead >= 2 ? 'out' : canCatch <= 1 && t.dw > 0 ? 'clinched' : 'alive';
    }
  }
}

async function buildLeague(key) {
  const cfg = TEAMS[key];
  const DIVS = cfg.divs;
  const nonce = await getNonce();
  const lists = await Promise.all(DIVS.map((d) => divisionTeams(nonce, d)));
  const teams = await Promise.all(lists.flat().map(scrapeTeam));
  const divOf = Object.fromEntries(teams.map((t) => [t.name, t.division]));
  for (const t of teams) {
    const done = t.games.filter((g) => g.us !== null);
    const isDiv = (g) => divOf[g.opponent] === t.division;
    t.w = done.filter((g) => g.us > g.them).length;
    t.l = done.filter((g) => g.us < g.them).length;
    t.dw = done.filter((g) => isDiv(g) && g.us > g.them).length;
    t.dl = done.filter((g) => isDiv(g) && g.us < g.them).length;
    t.divLeft = t.games.filter((g) => g.us === null && isDiv(g)).length;
    t.pf = done.reduce((a, g) => a + g.us, 0);
    t.pa = done.reduce((a, g) => a + g.them, 0);
    t.last = cfg.prior[t.name] || null;
  }
  powerRatings(teams, cfg);
  simulate(teams, DIVS);
  status(teams, DIVS);
  return { fetchedAt: new Date().toISOString(), team: cfg.label, divisions: DIVS, teams };
}

module.exports = { buildLeague, TEAMS };
