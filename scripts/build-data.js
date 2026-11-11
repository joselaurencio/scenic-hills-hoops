// writes public/data/league-<team>.json; run by the GitHub Action before each deploy
const fs = require('fs');
const path = require('path');
const { buildLeague, TEAMS } = require('../lib/league');

(async () => {
  const out = path.join(__dirname, '..', 'public', 'data');
  fs.mkdirSync(out, { recursive: true });
  for (const key of Object.keys(TEAMS)) {
    const data = await buildLeague(key);
    fs.writeFileSync(path.join(out, `league-${key}.json`), JSON.stringify(data));
    console.log(`${key}: ${data.teams.length} teams`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
