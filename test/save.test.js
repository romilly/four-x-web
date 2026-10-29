const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');
const g = require('../core.js');

function played(turns = 6) {
  let s = g.newGame(77, 'hard'); const rng = g.makeRng(s.rngState);
  for (let t = 0; t < turns; t++) {
    s = g.resolveTurn(s, { 0: g.aiOrders(g.fogView(s, 0), 0, rng), 1: g.aiOrders(g.sightOf(s, 1), 1, rng), 2: g.aiOrders(g.sightOf(s, 2), 2, rng) }, rng).state;
    s.rngState = rng.state;
  }
  return s;
}
const asYaml = (game, orders = []) => yaml.dump(g.toSave(game, orders), g.SAVE_YAML);
const roundTrip = (game, orders) => g.fromSave(yaml.load(asYaml(game, orders)));
const broken = (mutate) => { const d = yaml.load(asYaml(played(2))); mutate(d); return () => g.fromSave(d); };

test('a save names its format and version', () => {
  const d = g.toSave(g.newGame(1));
  assert.equal(d.format, g.SAVE_FORMAT);
  assert.equal(d.version, g.SAVE_VERSION);
});

test('a game survives a YAML round trip unchanged, queued orders included', () => {
  const s = played(), orders = [{ t: 'research', tech: 'weapons' }];
  const back = roundTrip(s, orders);
  assert.deepEqual(back.game, s);
  assert.deepEqual(back.orders, orders);
});

test('a loaded game plays on exactly as the original would', () => {
  const s = played(), back = roundTrip(s).game;
  const next = x => { const rng = g.makeRng(x.rngState); return g.resolveTurn(x, { 1: g.aiOrders(g.sightOf(x, 1), 1, rng) }, rng).state; };
  assert.deepEqual(next(back), next(s));
});

test('files that are not saves are refused', () => {
  assert.throws(() => g.fromSave(null), /isn't a Gabriel's Reach save/);
  assert.throws(() => g.fromSave({ hello: 'world' }), /isn't a Gabriel's Reach save/);
  assert.throws(() => g.fromSave(yaml.load('- just\n- a list\n')), /isn't a Gabriel's Reach save/);
});

test('saves from a newer version are refused with a clear reason', () => {
  assert.throws(broken(d => { d.version = g.SAVE_VERSION + 1; }), /newer version/);
});

test('saves in an older format without a migration are refused', () => {
  assert.throws(broken(d => { d.version = 0; }), /older format/);
});

test('a save without a version is refused', () => {
  assert.throws(broken(d => { delete d.version; }), /no version/);
});

test('damaged saves are refused instead of breaking the game', () => {
  assert.throws(broken(d => { d.game.fleets[0].at = 999; }), /damaged.*fleet/);
  assert.throws(broken(d => { d.game.planets[0].type = 'lava'; }), /damaged.*planet/);
  assert.throws(broken(d => { d.game.lanes.push([0, 500]); }), /damaged.*lane/);
  assert.throws(broken(d => { d.game.empires.pop(); }), /damaged.*empires/);
  assert.throws(broken(d => { d.game.difficulty = 'impossible'; }), /damaged.*difficulty/);
  assert.throws(broken(d => { d.orders = [{ t: 'teleport' }]; }), /damaged.*order/);
});
