// Fleets are stopped by parked enemy fighters on their way, and route around known hostile stars when they can
// do so without a longer journey.
const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../core.js');

// A diamond, 0 to 3 by way of 1 or 2, and a longer way round through 4 and 5.
//      1
//    /   \
//   0     3
//   |\   /|
//   | 2   |
//   4 --- 5
const DIAMOND = [[1, 2, 4], [0, 3], [0, 3], [1, 2, 5], [0, 5], [4, 3]];

test('with nothing to avoid, routes are the shortest, as before', () => {
  assert.deepEqual(g.route(DIAMOND, 0, 3), [1, 3]);
  assert.deepEqual(g.route(DIAMOND, 0, 3, new Set()), [1, 3]);
  assert.deepEqual(g.route(DIAMOND, 0, 0), []);
});

test('among equally short routes, a fleet takes the one through fewer hostile stars', () => {
  assert.deepEqual(g.route(DIAMOND, 0, 3, new Set([1])), [2, 3]);
  assert.deepEqual(g.route(DIAMOND, 0, 3, new Set([2])), [1, 3]);
});

test('avoiding hostiles never makes a journey longer', () => {
  assert.deepEqual(g.route(DIAMOND, 0, 3, new Set([1, 2])), [1, 3]);
  assert.equal(g.route(DIAMOND, 0, 3, new Set([1, 2])).length, 2);
});

test('the destination itself does not count as a star to avoid', () => {
  assert.deepEqual(g.route(DIAMOND, 0, 3, new Set([3, 2])), [1, 3]);
});

test('routes in real galaxies keep their old shape when nothing is hostile', () => {
  // The old router: breadth first, first discoverer wins.
  const old = (adj, from, to) => {
    if (from === to) return [];
    const prev = adj.map(() => -1); prev[from] = from; const q = [from];
    for (let k = 0; k < q.length; k++) { const u = q[k]; if (u === to) break; for (const v of adj[u]) if (prev[v] < 0) { prev[v] = u; q.push(v); } }
    if (prev[to] < 0) return null;
    const p = []; for (let v = to; v !== from; v = prev[v]) p.push(v); return p.reverse();
  };
  for (const seed of [1, 42, 777]) {
    const s = g.newGame(seed, 'normal', 'medium'), adj = g.adjOf(s);
    for (let a = 0; a < s.stars.length; a += 5) for (let b = 0; b < s.stars.length; b += 3)
      assert.deepEqual(g.route(adj, a, b, new Set()), old(adj, a, b), `seed ${seed}: ${a} to ${b}`);
  }
});

test('an empire knows a star is hostile if it can see enemy fighters or an enemy planet there', () => {
  const s = g.newGame(42);
  const home1 = s.empires[1].home;
  const h = g.hostileStars(s, 0);
  assert.ok(h.has(home1), 'a rival home planet');
  assert.ok(!h.has(s.empires[0].home), 'not its own home');
  // Through fog of war, an unseen rival home is not known to be hostile.
  const fogged = g.hostileStars(g.fogView(s, 0), 0);
  assert.ok(!fogged.has(home1));
});

// Find a star with a neighbour in the middle of a two-jump journey: from -> mid -> to, with to not next to from.
function corridor(s) {
  const adj = g.adjOf(s);
  for (let from = 0; from < s.stars.length; from++) for (const mid of adj[from]) for (const to of adj[mid]) {
    if (to === from || adj[from].includes(to)) continue;
    const others = adj[from].filter(v => v !== mid && adj[v].includes(to)); // other two-jump ways
    if (others.length) continue; // only one way, so the router cannot step around the blocker
    if (s.planets.some(p => [from, mid, to].includes(p.star) && p.owner >= 0)) continue; // keep planets out of it
    return { from, mid, to };
  }
  throw new Error('no corridor');
}

// A player fleet of 3 fighters with Hyperdrives 1 (two jumps a turn) sent from -> to, and rival fighters at mid.
function setUp({ blockerMoving = false } = {}) {
  const s = g.newGame(42);
  const { from, mid, to } = corridor(s);
  s.empires[0].tech.drives = 1;
  s.fleets = [
    { id: 50, owner: 0, at: from, dest: to, target: null, ships: [1, 2, 3].map(id => ({ id: 500 + id, type: 'fighter' })) },
    { id: 60, owner: 1, at: mid, dest: blockerMoving ? from : null, target: null, ships: [{ id: 601, type: 'fighter' }] },
  ];
  return { s, from, mid, to };
}
const after = s => g.resolveTurn(s, {}, g.makeRng(3)).state;

test('a fleet passing a star where enemy fighters are parked is stopped there', () => {
  const { s, mid, to } = setUp();
  const r = after(s), f = r.fleets.find(f => f.id === 50);
  assert.ok(f, 'the fleet survives three against one');
  assert.equal(f.at, mid);
  assert.equal(f.dest, to, 'it still means to go on');
  assert.ok(!r.fleets.some(f => f.id === 60), 'and the battle happens there');
});

test('without the enemy there, the same fleet makes both jumps', () => {
  const { s, to } = setUp();
  s.fleets = s.fleets.filter(f => f.owner === 0);
  const f = after(s).fleets.find(f => f.id === 50);
  assert.equal(f.at, to);
  assert.equal(f.dest, null);
});

test('enemy fleets that are themselves on the move do not stop anyone', () => {
  const { s, to } = setUp({ blockerMoving: true });
  const f = after(s).fleets.find(f => f.id === 50);
  assert.equal(f.at, to);
});

test('the turn report says when your fleet is intercepted', () => {
  const { s } = setUp();
  const r = after(s);
  assert.ok(r.events.some(e => /Fleet 50 was intercepted at .+ by Veth Hegemony fighters\./.test(e.msg)), JSON.stringify(r.events));
});

test('a fleet steps around a hostile star it can see, when another route is just as short', () => {
  const s = g.newGame(42), adj = g.adjOf(s);
  let found = null;
  for (let from = 0; from < s.stars.length && !found; from++) for (let to = 0; to < s.stars.length && !found; to++) {
    if (to === from || adj[from].includes(to)) continue;
    const mids = adj[from].filter(v => adj[v].includes(to));
    if (mids.length >= 2) found = { from, to, mids };
  }
  const { from, to } = found;
  const usual = g.route(adj, from, to)[0];
  s.fleets = [
    { id: 50, owner: 0, at: from, dest: to, target: null, ships: [{ id: 501, type: 'fighter' }] },
    { id: 60, owner: 1, at: usual, dest: null, target: null, ships: [{ id: 601, type: 'fighter' }, { id: 602, type: 'fighter' }] },
  ];
  const f = after(s).fleets.find(f => f.id === 50);
  assert.ok(f && f.at !== usual && adj[from].includes(f.at) && adj[f.at].includes(to), `went by ${f && f.at}, not ${usual}`);
});
