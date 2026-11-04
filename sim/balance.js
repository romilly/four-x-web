// Balance simulations: play many galaxies with a scripted stand-in on the player's side, under difficulty variants.
// The stand-in is the rivals' own AI, playing with fog of war and Normal habits, so results compare settings
// against each other; they do not predict how a person will fare.
//
// Give it a spec as JSON, as a file name or on stdin; it writes one JSON line per game:
//   node sim/balance.js sim/example.json
// From Python, use sim/balance.py, which returns a pandas DataFrame. The spec:
//   size       'small' | 'medium' | 'large'                       (default 'small')
//   galaxies   how many galaxies per variant                      (default 24)
//   seeds      the galaxy seeds, instead of 1000, 1037, 1074, ... (optional)
//   turns      stop unfinished games after this many turns        (default 200)
//   victory    'total' | 'dominance'                              (default 'total')
//   variants   { name: { base: 'easy'|'normal'|'hard', ...overrides of that level's settings } }
// The settings are those in DIFF in core.js: fog, attackTurn, shipShare, income.
const g = require('../core.js');

const TRIAL = '__trial';
const SHARE_TURNS = [30, 60, 120];
const fighters = (s, e) => s.fleets.filter(f => f.owner === e).reduce((a, f) => a + g.countTypes(f).fighter, 0);

function check(spec) {
  const size = spec.size ?? 'small';
  if (!g.SIZES[size]) throw new Error(`size "${size}" is unknown; use one of ${Object.keys(g.SIZES).join(', ')}`);
  const variants = Object.entries(spec.variants ?? {});
  if (!variants.length) throw new Error('give at least one variant, e.g. {"Hard": {"base": "hard"}}');
  for (const [name, v] of variants) {
    const base = v.base ?? 'normal';
    if (!g.DIFF[base] || base === TRIAL) throw new Error(`variant "${name}": base "${base}" is unknown; use easy, normal or hard`);
    const settings = Object.keys(g.DIFF[base]).filter(k => k !== 'label');
    for (const k of Object.keys(v)) if (k !== 'base' && !settings.includes(k)) throw new Error(`variant "${name}": unknown setting "${k}"; settings are ${settings.join(', ')}`);
  }
  const galaxies = spec.galaxies ?? 24;
  const seeds = spec.seeds ?? Array.from({ length: galaxies }, (_, i) => 1000 + i * 37);
  return { size, seeds, turns: spec.turns ?? 200, victory: spec.victory ?? 'total', variants };
}

// One game: the stand-in is empire 0; every rival plays with the variant's settings.
function playOne(seed, { size, turns, victory }) {
  let s = g.newGame(seed, TRIAL, size, victory);
  const rng = g.makeRng(s.rngState);
  const row = { seed, size };
  for (const t of SHARE_TURNS) Object.assign(row, { [`share_${t}`]: null, [`income_${t}`]: null, [`best_rival_income_${t}`]: null });
  let fleet = 0;
  for (let t = 0; t < turns && !s.over; t++) {
    const orders = {};
    for (const e of s.empires) if (e.alive) orders[e.id] = e.id === 0
      ? g.aiOrders({ ...g.fogView(s, 0), difficulty: 'normal' }, 0, rng)
      : g.aiOrders(g.sightOf(s, e.id), e.id, rng);
    s = g.resolveTurn(s, orders, rng).state;
    s.rngState = rng.state;
    for (const e of s.empires) if (e.id) fleet = Math.max(fleet, fighters(s, e.id));
    if (SHARE_TURNS.includes(s.turn) && s.empires[0].alive) {
      const hab = s.planets.filter(p => p.cap > 0).length, rivals = s.empires.filter(e => e.id && e.alive);
      row[`share_${s.turn}`] = +(s.planets.filter(p => p.owner === 0).length / hab).toFixed(3);
      row[`income_${s.turn}`] = g.incomeOf(s, 0);
      row[`best_rival_income_${s.turn}`] = rivals.length ? Math.max(...rivals.map(e => g.incomeOf(s, e.id))) : 0;
    }
  }
  row.result = !s.over ? 'unfinished' : s.over.win ? 'win' : 'loss';
  row.end_turn = s.turn;
  row.biggest_rival_fleet = fleet;
  return row;
}

// Plays every galaxy under every variant and returns one row per game. The real difficulty levels are not changed.
function runGames(spec, onRow = () => {}) {
  const c = check(spec), rows = [];
  try {
    for (const [name, v] of c.variants) {
      const { base = 'normal', ...overrides } = v;
      g.DIFF[TRIAL] = { ...g.DIFF[base], label: name, ...overrides };
      for (const seed of c.seeds) { const row = { variant: name, ...playOne(seed, c) }; rows.push(row); onRow(row); }
    }
  } finally { delete g.DIFF[TRIAL]; }
  return rows;
}

module.exports = { runGames };

if (require.main === module) {
  const fs = require('fs');
  const text = fs.readFileSync(process.argv[2] ?? 0, 'utf8');
  try { runGames(JSON.parse(text), row => process.stdout.write(JSON.stringify(row) + '\n')); }
  catch (e) { process.stderr.write(e.message + '\n'); process.exit(1); }
}
