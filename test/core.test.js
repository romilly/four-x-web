const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../core.js');

const myFleets = s => s.fleets.filter(f => f.owner === 0);
const seeds = [1, 42, 777, 2026, 99, 314, 8080, 5];

test('a new galaxy gives each empire a home planet and one fleet', () => {
  const s = g.newGame(5);
  assert.equal(s.stars.length, 28);
  assert.equal(s.fleets.length, 3);
  for (const e of s.empires) {
    const home = s.planets.filter(p => p.owner === e.id);
    assert.equal(home.length, 1);
    assert.equal(home[0].star, e.home);
    assert.equal(home[0].pop, 3);
  }
});

test('the same seed builds the same galaxy', () => {
  assert.deepEqual(g.newGame(42).planets, g.newGame(42).planets);
});

test('stars have between 0 and 5 planets', () => {
  for (const seed of seeds) {
    const s = g.newGame(seed);
    for (const st of s.stars) assert.ok(g.planetsAt(s, st.id).length <= 5);
  }
});

test('star colour shapes the planets: yellow stars beat blue-white for habitability', () => {
  const hab = { 0: [], 2: [] };
  for (let seed = 1; seed <= 40; seed++) {
    const s = g.newGame(seed);
    for (const st of s.stars) if (st.kind in hab && !s.empires.some(e => e.home === st.id))
      for (const p of g.planetsAt(s, st.id)) hab[st.kind].push(p.cap);
  }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(mean(hab[2]) > mean(hab[0]) + 1, `yellow ${mean(hab[2])}, blue ${mean(hab[0])}`);
});

test('every home has a habitable free planet within one jump', () => {
  for (const seed of seeds) {
    const s = g.newGame(seed), adj = g.adjOf(s);
    for (const e of s.empires) {
      const near = [e.home, ...adj[e.home]];
      assert.ok(s.planets.some(p => near.includes(p.star) && p.owner < 0 && p.cap >= 2), `seed ${seed} empire ${e.id}`);
    }
  }
});

test('split leaves the rest of the fleet behind', () => {
  const s = g.newGame(5), f = myFleets(s)[0], to = g.adjOf(s)[f.at][0];
  const p = g.previewOrders(s, 0, [{ t: 'split', fleet: f.id, ships: { fighter: 1, colony: 1 }, to }]);
  const [stay, go] = myFleets(p).sort((a, b) => a.id - b.id);
  assert.equal(stay.ships.length, 2);
  assert.deepEqual(g.countTypes(go), { fighter: 1, colony: 1, scout: 0 });
  assert.equal(go.dest, to);
});

test('merge joins fleets parked at the same star', () => {
  const s = g.newGame(5), f = myFleets(s)[0];
  const p = g.previewOrders(s, 0, [{ t: 'split', fleet: f.id, ships: { fighter: 1 }, to: f.at }, { t: 'merge', star: f.at }]);
  assert.equal(myFleets(p).length, 1);
  assert.equal(myFleets(p)[0].ships.length, 4);
});

// A small hand-built system for rule tests: star 0 holds planets 0..2, star 1 is next door.
function arena() {
  const s = g.newGame(5);
  const st = s.empires[0].home, other = g.adjOf(s)[st][0];
  s.planets = [
    { id: 0, star: st, name: 'A I', type: 'terran', cap: 6, owner: 0, pop: 3 },
    { id: 1, star: st, name: 'A II', type: 'arid', cap: 3, owner: -1, pop: 0 },
    { id: 2, star: st, name: 'A III', type: 'ocean', cap: 5, owner: -1, pop: 0 },
    { id: 3, star: other, name: 'B I', type: 'arid', cap: 2, owner: 1, pop: 4 },
    { id: 4, star: other, name: 'B II', type: 'tundra', cap: 2, owner: 1, pop: 1 },
  ];
  s.intel = s.empires.map(() => ({ stars: s.stars.map(() => false), planets: s.planets.map(() => null) }));
  s.fleets = [{ id: 1, owner: 0, at: st, dest: null, target: null, ships: [{ id: 1, type: 'colony' }] },
              { id: 2, owner: 1, at: s.empires[1].home, dest: null, target: null, ships: [{ id: 2, type: 'colony' }] }];
  return { s, st, other };
}

test('a colony ship settles its target planet', () => {
  const { s } = arena();
  const r = g.resolveTurn(s, { 0: [{ t: 'target', fleet: 1, planet: 1 }] }, g.makeRng(1)).state;
  assert.equal(r.planets.find(p => p.id === 1).owner, 0);
  assert.equal(r.planets.find(p => p.id === 2).owner, -1);
});

test('without a target a colony ship waits instead of settling', () => {
  const { s } = arena();
  const r = g.resolveTurn(s, { 0: [] }, g.makeRng(1)).state;
  assert.ok(r.planets.filter(p => p.star === s.planets[0].star).every(p => p.id === 0 || p.owner === -1));
  assert.ok(r.fleets.some(f => f.owner === 0 && g.has(f, 'colony')), 'the colony ship is still in orbit');
});

test('a newly built colony ship does not settle on its own', () => {
  const { s, st } = arena();
  s.fleets = s.fleets.filter(f => f.owner !== 0);
  s.empires[0].credits = 100;
  let r = g.resolveTurn(s, { 0: [{ t: 'build', star: st, kind: 'colony' }] }, g.makeRng(1)).state;
  r = g.resolveTurn(r, { 0: [] }, g.makeRng(2)).state;
  assert.equal(r.planets.filter(p => p.owner === 0).length, 1);
});

test('fighters besiege their target planet, otherwise the weakest', () => {
  const { s, other } = arena();
  const fighters = n => Array.from({ length: n }, (_, i) => ({ id: 100 + i, type: 'fighter' }));
  s.fleets.push({ id: 3, owner: 0, at: other, dest: null, target: 3, ships: fighters(4) });
  let r = g.resolveTurn(s, {}, g.makeRng(3)).state;
  assert.ok(r.planets.find(p => p.id === 3).pop < 4, 'targeted planet loses population');
  assert.equal(r.planets.find(p => p.id === 4).pop >= 1, true);
  s.fleets[2].target = null;
  r = g.resolveTurn(s, {}, g.makeRng(3)).state;
  assert.equal(r.planets.find(p => p.id === 4).owner, 0, 'weakest planet falls first');
});

test('income comes from planet population', () => {
  const { s } = arena();
  assert.equal(g.incomeOf(s, 0), 2 + 3);
});

test('fog of war hides distant planet owners and fleets from rivals', () => {
  const s = g.newGame(5), seen = g.vision(s, 1), v = g.fogView(s, 1);
  assert.ok(v.fleets.every(f => f.owner === 1 || seen[f.at]));
  assert.ok(!v.planets.some(p => p.star === s.empires[0].home && p.owner === 0));
  assert.ok(v.stars[s.empires[0].home].unknown);
});

test('rivals remember planets as last seen', () => {
  const s = g.newGame(5), p = s.planets.find(p => p.owner === 1);
  s.intel[1].planets[p.id] = { owner: 2, pop: 9 };
  s.intel[1].stars[p.star] = true;
  const before = g.fogView(s, 1).planets.find(x => x.id === p.id);
  assert.equal(before.owner, 1, 'live view wins inside sensor range');
});

test('hard rivals see the whole map', () => {
  const s = g.newGame(5, 'hard');
  assert.equal(g.sightOf(s, 1), s);
});

function selfPlay(seed, difficulty, turns = 150) {
  let s = g.newGame(seed, difficulty); const rng = g.makeRng(s.rngState);
  for (let t = 0; t < turns && !s.over; t++) {
    const me = { ...g.fogView(s, 0), difficulty: 'normal' };
    s = g.resolveTurn(s, { 0: g.aiOrders(me, 0, rng), 1: g.aiOrders(g.sightOf(s, 1), 1, rng), 2: g.aiOrders(g.sightOf(s, 2), 2, rng) }, rng).state;
  }
  return s;
}

test('self-play runs to completion and empires spread over many planets', () => {
  for (const seed of [1, 42, 777]) {
    const s = selfPlay(seed, 'normal', 200);
    assert.ok(s.turn > 1);
    assert.ok(s.planets.filter(p => p.owner >= 0).length > 6, `seed ${seed}`);
  }
});

test('difficulty levels rank in order for a scripted stand-in', () => {
  // Planet games rarely finish inside 120 turns, so compare how much of the galaxy the stand-in holds.
  // 24 galaxies: with fewer, Normal and Hard can tie by chance.
  const many = Array.from({ length: 24 }, (_, i) => 1000 + i * 37);
  const held = d => many.reduce((n, seed) => n + selfPlay(seed, d, 120).planets.filter(p => p.owner === 0).length, 0);
  const easy = held('easy'), normal = held('normal'), hard = held('hard');
  assert.ok(easy > normal && normal > hard, `easy ${easy}, normal ${normal}, hard ${hard}`);
});

// Two colony ships in one fleet, two free planets in the system.
function twoShips() {
  const s = g.newGame(g.TUTORIAL_SEED), h = s.empires[0].home, f = s.fleets.find(f => f.owner === 0);
  f.ships.push({ id: 99, type: 'colony' });
  const [a, b] = g.planetsAt(s, h).filter(p => p.owner < 0 && p.cap > 0).map(p => p.id);
  return { s, h, f, a, b };
}

test('two colony ships in one fleet can settle two planets in the same turn', () => {
  const { s, h, f, a, b } = twoShips();
  const orders = [];
  for (const planet of [a, b]) orders.push(g.colonyOrder(g.previewOrders(s, 0, orders), f.id, planet));
  const r = g.resolveTurn(s, { 0: orders }, g.makeRng(1)).state;
  assert.equal(r.planets.find(p => p.id === a).owner, 0);
  assert.equal(r.planets.find(p => p.id === b).owner, 0);
});

test('Colonise on a fleet with no target simply aims it', () => {
  const { s, f, a } = twoShips();
  assert.deepEqual(g.colonyOrder(s, f.id, a), { t: 'target', fleet: f.id, planet: a });
});

test('Colonise splits off one colony ship when the fleet is already aimed elsewhere', () => {
  const { s, f, a, b } = twoShips();
  const v = g.previewOrders(s, 0, [{ t: 'target', fleet: f.id, planet: a }]);
  assert.deepEqual(g.colonyOrder(v, f.id, b), { t: 'split', fleet: f.id, ships: { colony: 1 }, to: f.at, target: b });
});

test('a fleet whose only ship is a colony ship is re-aimed, not split', () => {
  const { s, f, a, b } = twoShips();
  f.ships = [{ id: 3, type: 'colony' }];
  const v = g.previewOrders(s, 0, [{ t: 'target', fleet: f.id, planet: a }]);
  assert.deepEqual(g.colonyOrder(v, f.id, b), { t: 'target', fleet: f.id, planet: b });
});

test('Colonise keeps fighters on their attack target by splitting the colony ship off', () => {
  const { s, f, a } = twoShips();
  const enemy = s.planets.find(p => p.owner === 1);
  f.target = enemy.id;
  assert.equal(g.colonyOrder(s, f.id, a).t, 'split');
});

test('a fleet still travelling splits its colony ship toward the same destination', () => {
  const { s, h, f, a, b } = twoShips();
  f.at = g.adjOf(s)[h][0]; f.dest = h; f.target = a;
  assert.deepEqual(g.colonyOrder(s, f.id, b), { t: 'split', fleet: f.id, ships: { colony: 1 }, to: h, target: b });
});

test('a fleet with one colony ship already aimed at a free planet is re-aimed, not split', () => {
  const { s, f, a, b } = twoShips();
  f.ships = f.ships.filter(x => x.id !== 99); // fighters, one colony ship, a scout
  const v = g.previewOrders(s, 0, [{ t: 'target', fleet: f.id, planet: a }]);
  assert.deepEqual(g.colonyOrder(v, f.id, b), { t: 'target', fleet: f.id, planet: b });
});

// ---------- shipyard capacity ----------
test('a system launches 1 ship a turn, plus 1 for every 4 people on your planets there', () => {
  const s = g.newGame(g.TUTORIAL_SEED), h = s.empires[0].home, home = s.planets.find(p => p.owner === 0);
  home.pop = 3; assert.equal(g.shipyardCapacity(s, 0, h), 1);
  home.pop = 4; assert.equal(g.shipyardCapacity(s, 0, h), 2);
  const other = g.planetsAt(s, h).find(p => p.owner < 0 && p.cap > 0);
  other.owner = 0; other.pop = 4; assert.equal(g.shipyardCapacity(s, 0, h), 3);
  assert.equal(g.shipyardCapacity(s, 0, s.empires[1].home), 0, 'no shipyard where you hold no planet');
});

test('builds beyond a system\'s capacity are refused and cost nothing', () => {
  const s = g.newGame(g.TUTORIAL_SEED), h = s.empires[0].home;
  s.empires[0].credits = 100;
  const r = g.resolveTurn(s, { 0: [1, 2, 3].map(() => ({ t: 'build', star: h, kind: 'fighter' })) }, g.makeRng(1)).state;
  const fighters = r.fleets.filter(f => f.owner === 0).reduce((n, f) => n + g.countTypes(f).fighter, 0);
  assert.equal(fighters, 2 + 1, 'started with 2, capacity 1');
  assert.equal(r.empires[0].credits, 100 - 15 + g.incomeOf(r, 0));
});

test('each system has its own capacity', () => {
  const s = g.newGame(g.TUTORIAL_SEED), h = s.empires[0].home, other = g.adjOf(s)[h].find(j => g.planetsAt(s, j).length);
  const p = g.planetsAt(s, other)[0]; p.owner = 0; p.pop = 1;
  s.empires[0].credits = 100;
  const o = [h, h, other, other].map(star => ({ t: 'build', star, kind: 'scout' }));
  const r = g.resolveTurn(s, { 0: o }, g.makeRng(1)).state;
  const scouts = r.fleets.filter(f => f.owner === 0).reduce((n, f) => n + g.countTypes(f).scout, 0);
  assert.equal(scouts, 1 + 2, 'started with 1, one more from each system');
});

test('rivals respect shipyard capacity too', () => {
  let s = g.newGame(7, 'hard'); const rng = g.makeRng(s.rngState);
  for (let t = 0; t < 30; t++) {
    const orders = {};
    for (const e of s.empires) if (e.id) orders[e.id] = g.aiOrders(g.sightOf(s, e.id), e.id, rng);
    for (const [e, os] of Object.entries(orders)) {
      const per = {};
      for (const o of os) if (o.t === 'build') per[o.star] = (per[o.star] || 0) + 1;
      for (const [star, n] of Object.entries(per)) assert.ok(n <= g.shipyardCapacity(s, +e, +star), `turn ${s.turn}: empire ${e} ordered ${n} at ${star}`);
    }
    s = g.resolveTurn(s, orders, rng).state;
  }
});

test('ships built in one system in one turn give a single dispatch', () => {
  const s = g.newGame(g.TUTORIAL_SEED), h = s.empires[0].home;
  s.planets.find(p => p.owner === 0).pop = 9; // capacity 3
  s.empires[0].credits = 200;
  const builds = ['fighter', 'fighter', 'scout'].map(kind => ({ t: 'build', star: h, kind }));
  const { events } = g.resolveTurn(s, { 0: builds }, g.makeRng(1));
  const built = events.filter(e => e.kind === 'build');
  assert.equal(built.length, 1);
  assert.equal(built[0].msg, `2 fighters and 1 scout created at ${s.stars[h].name} and joined Fleet 1.`);
  assert.equal(built[0].star, h);
});

test('a single new ship reads naturally', () => {
  const s = g.newGame(g.TUTORIAL_SEED), h = s.empires[0].home;
  s.empires[0].credits = 100;
  const { events } = g.resolveTurn(s, { 0: [{ t: 'build', star: h, kind: 'colony' }] }, g.makeRng(1));
  assert.equal(events.find(e => e.kind === 'build').msg, `1 colony ship created at ${s.stars[h].name} and joined Fleet 1.`);
});
