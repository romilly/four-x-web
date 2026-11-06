// Population grows by one every other turn, counted from when each planet was settled, so no empire gets an
// earlier start from how the game happens to number its planets.
const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../core.js');

const quiet = s => g.resolveTurn(s, {}, g.makeRng(1)).state; // a turn with no orders from anyone
const homes = s => s.empires.map(e => s.planets.find(p => p.owner === e.id && p.star === e.home).pop);

test('every homeworld grows on the same turns, whatever its number', () => {
  for (const seed of [11, 22, 33, 44, 55]) {
    let s = g.newGame(seed, 'normal', 'medium');
    const seen = [];
    for (let t = 0; t < 6; t++) { s = quiet(s); seen.push(homes(s)); }
    for (const row of seen) assert.equal(new Set(row).size, 1, `seed ${seed}: ${JSON.stringify(seen)}`);
    assert.deepEqual(seen.map(r => r[0]), [4, 4, 5, 5, 6, 6], `seed ${seed}`);
  }
});

test('a new colony first grows on the turn after it is settled, then every other turn', () => {
  let s = g.newGame(11, 'normal', 'small');
  const home = s.empires[0].home, fleet = s.fleets.find(f => f.owner === 0);
  const target = s.planets.find(p => p.owner < 0 && p.cap >= 3 && p.star === home)
    ?? (() => { const p = s.planets.find(p => p.owner < 0 && p.cap >= 3); fleet.at = p.star; return p; })();
  s = g.resolveTurn(s, { 0: [{ t: 'target', fleet: fleet.id, planet: target.id }] }, g.makeRng(1)).state;
  const settledOn = s.turn - 1;
  const p = () => s.planets[target.id];
  assert.equal(p().owner, 0);
  assert.equal(p().settled, settledOn);
  const pops = [p().pop];
  for (let t = 0; t < 4; t++) { s = quiet(s); pops.push(p().pop); }
  assert.deepEqual(pops, [1, 2, 2, 3, 3]);
});

test('equal empires have equal incomes on every turn', () => {
  let s = g.newGame(33, 'normal', 'large');
  for (let t = 0; t < 8; t++) {
    s = quiet(s);
    assert.equal(new Set(s.empires.map(e => g.incomeOf(s, e.id))).size, 1, `turn ${s.turn}`);
  }
});

test('a captured planet counts as newly settled by its captor', () => {
  // Simulated directly: capture sets the new owner, one person, and the turn of capture.
  let s = g.newGame(5);
  const victim = s.planets.find(p => p.owner === 1);
  const at = victim.star;
  victim.pop = 1;
  s.fleets = s.fleets.filter(f => f.owner !== 1);
  s.fleets.push({ id: 90, owner: 0, at, dest: null, target: victim.id, ships: Array.from({ length: 12 }, (_, i) => ({ id: 900 + i, type: 'fighter' })) });
  for (let t = 0; t < 6 && s.planets[victim.id].owner !== 0; t++) s = quiet(s);
  const p = s.planets[victim.id];
  assert.equal(p.owner, 0, 'captured');
  assert.ok(p.settled >= 1 && p.settled < s.turn);
});

test('saves from before this change, with no settling turns, still load and grow', () => {
  const s = g.newGame(7);
  for (const p of s.planets) delete p.settled;
  const back = g.fromSave(JSON.parse(JSON.stringify(g.toSave(s, [])))).game;
  const next = quiet(back);
  assert.ok(next.planets.filter(p => p.owner >= 0).every(p => p.pop === 4));
});
