const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../core.js');

const myFleets = s => s.fleets.filter(f => f.owner === 0);

test('a new galaxy gives each empire a home and one fleet', () => {
  const s = g.newGame(5);
  assert.equal(s.stars.length, 28);
  assert.equal(s.fleets.length, 3);
  for (const e of s.empires) assert.equal(s.stars[e.home].owner, e.id);
});

test('the same seed builds the same galaxy', () => {
  assert.deepEqual(g.newGame(42).stars, g.newGame(42).stars);
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

test('a split fleet moves when the turn resolves', () => {
  const s = g.newGame(5), f = myFleets(s)[0], to = g.adjOf(s)[f.at][0];
  const r = g.resolveTurn(s, { 0: [{ t: 'split', fleet: f.id, ships: { scout: 1 }, to }] }, g.makeRng(1)).state;
  assert.ok(myFleets(r).some(x => x.at === to));
});

test('fog of war hides distant fleets and the player home from rivals', () => {
  const s = g.newGame(5), seen = g.vision(s, 1), v = g.fogView(s, 1);
  assert.ok(v.fleets.every(f => f.owner === 1 || seen[f.at]));
  assert.equal(v.stars[s.empires[0].home].owner, -1);
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

test('self-play runs to completion without errors', () => {
  for (const seed of [1, 42, 777]) assert.ok(selfPlay(seed, 'normal', 200).turn > 1);
});

test('difficulty levels rank in order for a scripted stand-in', () => {
  const seeds = [1, 42, 777, 2026, 99, 314, 8080, 5];
  const wins = d => seeds.filter(seed => selfPlay(seed, d).over?.win).length;
  const easy = wins('easy'), normal = wins('normal'), hard = wins('hard');
  assert.ok(easy > normal && normal >= hard, `easy ${easy}, normal ${normal}, hard ${hard}`);
});
