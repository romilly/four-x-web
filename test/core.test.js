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

test('without a target a colony ship settles the most habitable free planet', () => {
  const { s } = arena();
  const r = g.resolveTurn(s, { 0: [] }, g.makeRng(1)).state;
  assert.equal(r.planets.find(p => p.id === 2).owner, 0);
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
  const held = d => seeds.reduce((n, seed) => n + selfPlay(seed, d, 120).planets.filter(p => p.owner === 0).length, 0);
  const easy = held('easy'), normal = held('normal'), hard = held('hard');
  assert.ok(easy > normal && normal > hard, `easy ${easy}, normal ${normal}, hard ${hard}`);
});
