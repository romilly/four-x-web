const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../core.js');

test('empire status counts systems, income and ships for every empire', () => {
  const s = g.newGame(42, 'impossible');
  // Give the player a second planet in its home system and one in another system, and an extra fleet.
  const home = s.empires[0].home;
  const [atHome, away] = s.planets.filter(p => p.owner < 0 && p.star !== home);
  atHome.star = home; atHome.owner = 0; atHome.pop = 1;
  away.owner = 0; away.pop = 2;
  s.fleets.push({ id: 99, owner: 0, at: home, dest: null, target: null, ships: [{ type: 'fighter' }, { type: 'scout' }] });

  const rows = g.empireStatus(s);
  assert.equal(rows.length, s.empires.length);
  const me = rows[0];
  assert.equal(me.name, 'Aurum Concord');
  assert.equal(me.systems, 2);
  assert.equal(me.planets, 3);
  assert.equal(me.income, g.incomeOf(s, 0));
  const ships = s.fleets.filter(f => f.owner === 0).flatMap(f => f.ships);
  assert.deepEqual([me.fighter, me.colony, me.scout], ['fighter', 'colony', 'scout'].map(t => ships.filter(x => x.type === t).length));
  for (const r of rows.slice(1)) assert.equal(r.income, g.incomeOf(s, r.id)); // includes the Impossible income bonus
});

test('a fallen empire is listed with nothing left', () => {
  const s = g.newGame(7);
  s.empires[2].alive = false;
  for (const p of s.planets) if (p.owner === 2) p.owner = -1;
  s.fleets = s.fleets.filter(f => f.owner !== 2);
  const r = g.empireStatus(s)[2];
  assert.deepEqual({ alive: r.alive, systems: r.systems, income: r.income, fighter: r.fighter, colony: r.colony, scout: r.scout },
    { alive: false, systems: 0, income: 0, fighter: 0, colony: 0, scout: 0 });
});
