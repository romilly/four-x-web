const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');
const g = require('../core.js');

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('galaxies are three-dimensional: stars spread above and below the plane', () => {
  for (const size of ['small', 'medium', 'large']) {
    const s = g.newGame(12, 'normal', size), zs = s.stars.map(st => st.z);
    assert.ok(zs.every(Number.isFinite), size);
    assert.ok(Math.max(...zs) - Math.min(...zs) > g.SIZES[size].radius * 0.25, `${size}: too flat`);
    assert.ok(zs.some(z => z > 0) && zs.some(z => z < 0), `${size}: one-sided`);
  }
});

test('the disc is thicker at the core than at the rim', () => {
  const core = [], rim = [];
  for (let seed = 1; seed <= 20; seed++) for (const st of g.newGame(seed, 'normal', 'large').stars) {
    const r = Math.hypot(st.x, st.y) / g.SIZES.large.radius;
    (r < 0.35 ? core : r > 0.75 ? rim : []).push(Math.abs(st.z));
  }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(mean(core) > mean(rim) * 1.4, `core ${mean(core).toFixed(1)}, rim ${mean(rim).toFixed(1)}`);
});

test('seen from above, stars never crowd each other, so names stay readable', () => {
  for (const seed of [1, 2, 3]) {
    const s = g.newGame(seed, 'normal', 'large');
    for (const a of s.stars) for (const b of s.stars) if (a.id < b.id) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 9.5);
  }
});

test('hyperlanes form a Gabriel graph in three dimensions', () => {
  const s = g.newGame(4, 'normal', 'medium');
  for (const [i, j] of s.lanes) {
    const A = s.stars[i], B = s.stars[j], d2 = dist(A, B) ** 2;
    for (const C of s.stars) if (C !== A && C !== B) assert.ok(dist(A, C) ** 2 + dist(B, C) ** 2 >= d2, `star ${C.id} sits inside lane ${i}-${j}`);
  }
  const reach = g.hops(g.adjOf(s), 0);
  assert.ok(reach.every(d => d < Infinity), 'every star is reachable');
});

test('the tutorial galaxy still teaches the colonising choice', () => {
  const s = g.newGame(g.TUTORIAL_SEED, 'easy'), h = s.empires[0].home;
  const free = g.planetsAt(s, h).filter(p => p.owner < 0 && p.cap > 0).map(p => p.cap).sort();
  assert.ok(free.length >= 2, 'two free planets at home');
  assert.ok(free[0] <= 3 && free[free.length - 1] >= 5, `a poor and a rich planet: ${free}`);
  assert.ok(g.adjOf(s)[h].length >= 3, 'several neighbours to explore');
});

test('saves keep each star\'s height', () => {
  const s = g.newGame(8, 'normal', 'medium');
  const back = g.fromSave(yaml.load(yaml.dump(g.toSave(s), g.SAVE_YAML))).game;
  assert.deepEqual(back.stars, s.stars);
});

test('a save from before 3D galaxies loads as a flat galaxy', () => {
  const d = yaml.load(yaml.dump(g.toSave(g.newGame(5)), g.SAVE_YAML));
  d.version = 2;
  for (const st of d.game.stars) delete st.z;
  const back = g.fromSave(d).game;
  assert.ok(back.stars.every(st => st.z === 0));
});

test('a star without a height is refused in a current save', () => {
  const d = yaml.load(yaml.dump(g.toSave(g.newGame(5)), g.SAVE_YAML));
  delete d.game.stars[3].z;
  assert.throws(() => g.fromSave(d), /damaged.*star/);
});
