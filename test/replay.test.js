// Replaying a galaxy: restart it at turn 1, or open it from a link.
const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../core.js');

function played(seed = 42, difficulty = 'hard', size = 'medium', victory = 'dominance', turns = 5) {
  let s = g.newGame(seed, difficulty, size, victory); const rng = g.makeRng(s.rngState);
  for (let t = 0; t < turns; t++) {
    const o = {}; for (const e of s.empires) if (e.alive) o[e.id] = g.aiOrders(g.sightOf(s, e.id), e.id, rng);
    s = g.resolveTurn(s, o, rng).state; s.rngState = rng.state;
  }
  return s;
}

test('restarting a galaxy takes it back to turn 1 with the same seed, size, victory and difficulty', () => {
  const s = played();
  assert.equal(s.turn, 6);
  const r = g.restartGame(s);
  assert.deepEqual(r, g.newGame(42, 'hard', 'medium', 'dominance'));
  assert.equal(r.turn, 1);
});

test('a galaxy link names the seed, size, victory and difficulty', () => {
  const link = g.galaxyLink(played(), 'https://romilly.github.io/four-x-web/');
  assert.equal(link, 'https://romilly.github.io/four-x-web/?galaxy=42&size=medium&victory=dominance&difficulty=hard');
});

test('a galaxy link reads back as the same galaxy', () => {
  const s = played(7, 'impossible', 'large', 'total');
  const spec = g.galaxyFromLink(new URL(g.galaxyLink(s, 'https://x.test/')).search);
  assert.deepEqual(spec, { seed: 7, size: 'large', victory: 'total', difficulty: 'impossible' });
  assert.deepEqual(g.newGame(spec.seed, spec.difficulty, spec.size, spec.victory), g.restartGame(s));
});

test('a link with only a galaxy number plays it small, to total victory, on Normal', () => {
  assert.deepEqual(g.galaxyFromLink('?galaxy=525128'), { seed: 525128, size: 'small', victory: 'total', difficulty: 'normal' });
});

test('pages without a galaxy, and damaged links, give nothing to play', () => {
  for (const q of ['', '?v=3', '?galaxy=', '?galaxy=abc', '?galaxy=-4', '?galaxy=1.5', '?galaxy=12&size=huge',
    '?galaxy=12&difficulty=brutal', '?galaxy=12&victory=sudden'])
    assert.equal(g.galaxyFromLink(q), null, q);
});
