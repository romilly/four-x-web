const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');
const g = require('../core.js');

const owned = (s, e) => s.planets.filter(p => p.owner === e).length;

test('galaxy sizes set the number of stars and empires', () => {
  for (const [size, stars, empires] of [['small', 28, 3], ['medium', 48, 5], ['large', 72, 7]]) {
    const s = g.newGame(11, 'normal', size);
    assert.equal(s.stars.length, stars, size);
    assert.equal(s.empires.length, empires, size);
    assert.equal(s.intel.length, empires, size);
    assert.equal(new Set(s.stars.map(st => st.name)).size, stars, `${size}: star names are unique`);
  }
});

test('the default is a small galaxy with total victory, unchanged from before', () => {
  const s = g.newGame(33);
  assert.equal(s.size, 'small');
  assert.equal(s.victory, 'total');
  assert.equal(s.stars[s.empires[0].home].name, 'Yed', 'the tutorial galaxy is the same');
});

test('every empire starts on its own homeworld, spread across the galaxy', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const s = g.newGame(seed, 'normal', 'large'), adj = g.adjOf(s);
    const homes = s.empires.map(e => e.home);
    assert.equal(new Set(homes).size, 7);
    for (const h of homes) {
      const d = g.hops(adj, h);
      for (const o of homes) if (o !== h) assert.ok(d[o] >= 2, `seed ${seed}: homes ${h} and ${o} are neighbours`);
    }
    for (const e of s.empires) assert.equal(owned(s, e.id), 1);
  }
});

test('every star is reachable in larger galaxies', () => {
  for (const size of ['medium', 'large']) {
    const s = g.newGame(8, 'normal', size), d = g.hops(g.adjOf(s), 0);
    assert.ok(d.every(x => x < Infinity), size);
  }
});

test('empire colours are all different', () => {
  const s = g.newGame(1, 'normal', 'large');
  assert.equal(new Set(s.empires.map(e => e.color)).size, 7);
});

// Hand over a share of habitable planets to an empire, for the victory tests.
function give(s, e, share) {
  const hab = s.planets.filter(p => p.cap > 0);
  const want = Math.ceil(hab.length * share);
  const guarded = new Set(s.fleets.filter(f => f.owner !== e).map(f => f.at));
  for (const p of hab) if (owned(s, e) < want && p.owner < 0 && !guarded.has(p.star)) { p.owner = e; p.pop = 1; }
  assert.ok(g.dominanceOf(s, e) >= share, 'test setup reached the share');
}

test('dominance: holding 60% of habitable planets wins', () => {
  const s = g.newGame(4, 'normal', 'medium', 'dominance');
  give(s, 0, 0.6);
  const r = g.resolveTurn(s, {}, g.makeRng(1)).state;
  assert.deepEqual({ win: r.over.win, how: r.over.how }, { win: true, how: 'dominance' });
});

test('dominance: a rival reaching 60% means you lose', () => {
  const s = g.newGame(4, 'normal', 'medium', 'dominance');
  give(s, 3, 0.6);
  const r = g.resolveTurn(s, {}, g.makeRng(1)).state;
  assert.equal(r.over.win, false);
  assert.equal(r.over.by, 3);
});

test('dominance cannot trigger early: it counts all habitable planets, not just settled ones', () => {
  let s = g.newGame(4, 'normal', 'small', 'dominance'); const rng = g.makeRng(s.rngState);
  for (let t = 0; t < 5; t++) s = g.resolveTurn(s, { 0: g.aiOrders(g.fogView(s, 0), 0, rng) }, rng).state;
  assert.equal(s.over, null);
  assert.ok(g.dominanceOf(s, 0) < 0.6);
});

test('total victory ignores the dominance share', () => {
  const s = g.newGame(4, 'normal', 'medium', 'total');
  give(s, 0, 0.7);
  assert.equal(g.resolveTurn(s, {}, g.makeRng(1)).state.over, null);
});

test('large galaxies save and load, with 7 empires', () => {
  const s = g.newGame(9, 'hard', 'large', 'dominance');
  const back = g.fromSave(yaml.load(yaml.dump(g.toSave(s), g.SAVE_YAML)));
  assert.deepEqual(back.game, s);
});

test('version 1 saves still load, as small galaxies with total victory', () => {
  const d = yaml.load(yaml.dump(g.toSave(g.newGame(5)), g.SAVE_YAML));
  d.version = 1; delete d.game.size; delete d.game.victory;
  const back = g.fromSave(d).game;
  assert.equal(back.size, 'small');
  assert.equal(back.victory, 'total');
});

test('a save whose empire count does not match its size is refused', () => {
  const d = yaml.load(yaml.dump(g.toSave(g.newGame(5, 'normal', 'medium')), g.SAVE_YAML));
  d.game.empires.pop();
  assert.throws(() => g.fromSave(d), /damaged.*empires/);
});

test('a large galaxy with seven AI empires resolves a turn quickly', () => {
  let s = g.newGame(21, 'normal', 'large'); const rng = g.makeRng(s.rngState);
  const t0 = Date.now();
  for (let t = 0; t < 60 && !s.over; t++) {
    const orders = {};
    for (const e of s.empires) orders[e.id] = g.aiOrders(g.sightOf(s, e.id), e.id, rng);
    s = g.resolveTurn(s, orders, rng).state;
  }
  const per = (Date.now() - t0) / 60;
  assert.ok(per < 150, `${per.toFixed(1)} ms per turn`);
  assert.ok(s.planets.filter(p => p.owner >= 0).length > 30);
});
