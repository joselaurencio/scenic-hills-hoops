// shared leaderboard for the Play tab. GET ?game=id -> top 20, POST {game, name, score}.
// Both the GitHub Pages and Vercel copies of the site call this, so CORS is open.
const { put, head } = require('@vercel/blob');

// highest believable score per game; anything above is rejected
const CAPS = { hotstreak: 200, buzzer: 400, crossover: 200000, rebound: 2000, fastbreak: 500, higherlower: 300,
  'trivia-classic': 3000, 'trivia-sudden': 200, 'trivia-speed': 200, 'trivia-hawks': 3000 };
const DAILY = /^(daily|trivia-daily)-\d{4}-\d{2}-\d{2}$/;
const BAD = /(fuck|shit|bitch|nigg|fag|cunt|dick|pussy|whore|slut|rape|nazi|porn|sex)/i;
const KEEP = 20;
const recent = new Map(); // ip -> last post time (best effort, per instance)

const cors = (res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('cache-control', 'no-store');
};
const capFor = (game) => CAPS[game] ?? (DAILY.test(game) ? (game.startsWith('daily') ? 20 : 3000) : null);

async function load(game) {
  try {
    const meta = await head(`lb/${game}.json`);
    return await (await fetch(`${meta.url}?t=${Date.now()}`, { cache: 'no-store' })).json();
  } catch (e) { return []; }
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const game = String((req.method === 'GET' ? req.query.game : (req.body || {}).game) || '');
  if (capFor(game) == null) return res.status(400).json({ error: 'unknown game' });
  try {
    if (req.method === 'GET') return res.status(200).json({ top: await load(game) });
    if (req.method !== 'POST') return res.status(405).end();

    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0];
    if (Date.now() - (recent.get(ip) || 0) < 5000) return res.status(429).json({ error: 'slow down' });
    recent.set(ip, Date.now());

    const name = String(req.body.name || '').replace(/[^\w .'-]/g, '').trim().slice(0, 16);
    const score = Math.floor(Number(req.body.score));
    if (!name || BAD.test(name.replace(/[^a-z]/gi, ''))) return res.status(400).json({ error: 'pick a different name' });
    if (!Number.isFinite(score) || score <= 0 || score > capFor(game)) return res.status(400).json({ error: 'bad score' });

    const top = await load(game);
    const mine = top.find((r) => r.name.toLowerCase() === name.toLowerCase());
    if (mine && mine.score >= score) return res.status(200).json({ top, kept: true }); // only your best counts
    const next = top.filter((r) => r !== mine).concat({ name, score, ts: Date.now() })
      .sort((a, b) => b.score - a.score || a.ts - b.ts).slice(0, KEEP);
    if (next.some((r) => r.name === name && r.score === score)) {
      await put(`lb/${game}.json`, JSON.stringify(next), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 });
    }
    res.status(200).json({ top: next });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
