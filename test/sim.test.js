const test = require('node:test');
const assert = require('node:assert/strict');
const { runGames } = require('../sim/balance.js');

const small = (variants, extra = {}) => runGames({ size: 'small', galaxies: 3, turns: 40, variants, ...extra });

test('one row per galaxy per variant, describing how each game went', () => {
  const rows = small({ Easy: { base: 'easy' }, Hard: { base: 'hard' } });
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map(r => r.variant), ['Easy', 'Easy', 'Easy', 'Hard', 'Hard', 'Hard']);
  for (const r of rows) {
    assert.ok(['win', 'loss', 'unfinished'].includes(r.result));
    assert.equal(r.size, 'small');
    assert.ok(Number.isInteger(r.seed) && Number.isInteger(r.end_turn));
    for (const k of ['share_30', 'income_30', 'best_rival_income_30', 'biggest_rival_fleet']) assert.ok(k in r, k);
  }
});

test('the same spec gives the same games', () => {
  const v = { Normal: { base: 'normal' } };
  assert.deepEqual(small(v), small(v));
});

test('galaxies use the seeds given, or 1000, 1037, 1074 and so on', () => {
  assert.deepEqual(small({ N: { base: 'normal' } }).map(r => r.seed), [1000, 1037, 1074]);
  assert.deepEqual(small({ N: { base: 'normal' } }, { seeds: [5, 6] }).map(r => r.seed), [5, 6]);
});

test('a variant overrides its base difficulty, and the override changes the games', () => {
  const rows = small({ 'Hard 125%': { base: 'hard' }, 'Hard 100%': { base: 'hard', income: 1.0 } });
  const income = v => rows.filter(r => r.variant === v).reduce((a, r) => a + (r.best_rival_income_30 ?? 0), 0);
  assert.ok(income('Hard 125%') > income('Hard 100%'));
});

test('the real difficulty levels are left as they were', () => {
  const before = JSON.stringify(require('../core.js').DIFF);
  small({ Odd: { base: 'hard', income: 3 } });
  assert.equal(JSON.stringify(require('../core.js').DIFF), before);
});

test('mistakes in a spec are refused with a reason', () => {
  assert.throws(() => small({ X: { base: 'brutal' } }), /base "brutal"/);
  assert.throws(() => small({ X: { base: 'hard', incom: 1 } }), /unknown setting "incom"; settings are fog, attackTurn, shipShare, income$/);
  assert.throws(() => small({ X: { base: 'hard', label: 'Mine' } }), /unknown setting "label"/);
  assert.throws(() => small({}), /at least one variant/);
  assert.throws(() => runGames({ size: 'huge', variants: { X: { base: 'easy' } } }), /size "huge"/);
});
