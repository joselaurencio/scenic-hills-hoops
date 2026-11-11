// writes public/data/league-<team>.json; run by the GitHub Action before each deploy.
// If texascharter.org is down, the last published file is reused so the site still deploys.
const fs = require('fs');
const path = require('path');
const { buildLeague, TEAMS } = require('../lib/league');

const LIVE = 'https://joselaurencio.github.io/scenic-hills-hoops/data/';

(async () => {
  const out = path.join(__dirname, '..', 'public', 'data');
  fs.mkdirSync(out, { recursive: true });
  let fresh = 0;
  for (const key of Object.keys(TEAMS)) {
    const file = path.join(out, `league-${key}.json`);
    try {
      const data = await buildLeague(key);
      fs.writeFileSync(file, JSON.stringify(data));
      fresh++;
      console.log(`${key}: ${data.teams.length} teams`);
    } catch (e) {
      console.warn(`${key}: build failed (${e.message}), reusing last published data`);
      const res = await fetch(`${LIVE}league-${key}.json?t=${Date.now()}`);
      if (!res.ok) throw new Error(`no fresh or previous data for ${key}`);
      fs.writeFileSync(file, await res.text());
    }
  }
  if (!fresh) console.warn('no league data refreshed this run');
})().catch((e) => { console.error(e); process.exit(1); });
