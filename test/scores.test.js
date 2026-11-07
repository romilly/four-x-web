// Each browser keeps a tally of wins, losses and abandoned games by difficulty and galaxy size.
const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../core.js');

const game = (over, turn = 12, difficulty = 'hard', size = 'medium') =>
  ({ ...g.newGame(9, difficulty, size), turn, over });
const WIN = { win: true, turn: 30 }, LOSS = { win: false, turn: 30 };

test('a finished game is a win or a loss; an unfinished one past turn 1 is abandoned', () => {
  assert.equal(g.scoreOutcome(game(WIN)), 'win');
  assert.equal(g.scoreOutcome(game(LOSS)), 'loss');
  assert.equal(g.scoreOutcome(game(null, 12)), 'abandoned');
});

test('leaving a game on turn 1 does not count, nor does a game already counted', () => {
  assert.equal(g.scoreOutcome(game(null, 1)), null);
  assert.equal(g.scoreOutcome({ ...game(WIN), scored: true }), null);
});

test('results are tallied by difficulty and size, without changing the old tally', () => {
  let s = g.emptyScores();
  const before = JSON.stringify(s);
  s = g.addScore(s, game(WIN), 'win');
  assert.equal(JSON.stringify(g.emptyScores()), before);
  s = g.addScore(s, game(WIN), 'win');
  s = g.addScore(s, game(null, 5, 'easy', 'large'), 'abandoned');
  assert.deepEqual(s.hard.medium, { win: 2, loss: 0, abandoned: 0 });
  assert.deepEqual(s.easy.large, { win: 0, loss: 0, abandoned: 1 });
  assert.deepEqual(s.normal.small, { win: 0, loss: 0, abandoned: 0 });
});

test('every difficulty and size has a row, all zero to start', () => {
  const s = g.emptyScores();
  assert.deepEqual(Object.keys(s), Object.keys(g.DIFF));
  for (const d of Object.keys(g.DIFF)) assert.deepEqual(Object.keys(s[d]), Object.keys(g.SIZES));
});

test('a stored tally is read back, and damaged or missing parts count as zero', () => {
  const s = g.addScore(g.emptyScores(), game(LOSS, 30, 'normal', 'small'), 'loss');
  assert.deepEqual(g.readScores(JSON.parse(JSON.stringify(s))), s);
  assert.deepEqual(g.readScores(null), g.emptyScores());
  assert.deepEqual(g.readScores('nonsense'), g.emptyScores());
  const odd = { normal: { small: { win: -3, loss: 'x', abandoned: 2.5 } }, brutal: { small: { win: 9 } } };
  assert.deepEqual(g.readScores(odd), g.emptyScores());
  assert.deepEqual(g.readScores({ easy: { large: { win: 4 } } }).easy.large, { win: 4, loss: 0, abandoned: 0 });
});

test('a saved game remembers that it has been counted', () => {
  const s = { ...game(WIN), scored: true };
  assert.equal(g.fromSave(JSON.parse(JSON.stringify(g.toSave(s, [])))).game.scored, true);
});
