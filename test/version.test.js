const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../core.js');
const pkg = require('../package.json');

test('the game version is semantic versioning: MAJOR.MINOR.PATCH', () => {
  assert.match(g.GAME_VERSION, /^\d+\.\d+\.\d+$/);
});

test('core.js and package.json carry the same version', () => {
  assert.equal(g.GAME_VERSION, pkg.version);
});

test('the changelog has an entry for this version', () => {
  const log = require('fs').readFileSync(require('path').join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
  assert.match(log, new RegExp(`^## ${g.GAME_VERSION.replace(/\./g, '\\.')} `, 'm'));
});

test('saves record the version of the game that made them, and still load', () => {
  const d = g.toSave(g.newGame(3));
  assert.equal(d.gameVersion, g.GAME_VERSION);
  assert.doesNotThrow(() => g.fromSave(d));
});
