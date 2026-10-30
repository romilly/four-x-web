// Shared test fixture: a page that serves the game from this repository and helpers for driving it.
const base = require('@playwright/test');

const { serveGame } = require('./serve');

const test = base.test.extend({
  // Seen-help is set so the help panel does not open on first visit, unless a test asks for a first visit.
  firstVisit: [false, { option: true }],
  page: async ({ page, firstVisit }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await serveGame(page);
    if (!firstVisit) await page.addInitScript(() => { try { localStorage.setItem('gr-help-3', '1'); } catch (e) {} });
    await use(page);
    base.expect(errors, 'script errors on the page').toEqual([]);
  },
});

const expect = base.expect;

// Open the game, optionally with a prepared game state built in the page by `setup(newGame, ...)`.
async function openGame(page, setup) {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelectorAll('.lbl').length > 0);
  if (setup) {
    await page.evaluate(setup);
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('.lbl').length > 0);
  }
}

// Store a game built by `make` (runs in the page, where newGame and the rest of core.js are globals).
const withGame = make => `(() => { const g = (${make})(); localStorage.setItem('gr-save-3', JSON.stringify({ game: g, pending: [] })); })()`;

// The on-screen position of the player's home star (its label is in the player's gold).
async function homeStar(page) {
  return page.evaluate(() => {
    const l = [...document.querySelectorAll('.lbl')].find(l => l.firstChild && l.firstChild.style.color === 'rgb(242, 181, 68)');
    const r = l.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y - 12 };
  });
}

// A tap on the map: a touch on phones, a click on desktops.
async function tap(page, { x, y }) {
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

async function selectHome(page) {
  await tap(page, await homeStar(page));
  await expect(page.locator('#sheetTitle')).not.toContainText('report');
}

const savedGame = page => page.evaluate(() => JSON.parse(localStorage.getItem('gr-save-3')).game);

module.exports = { test, expect, openGame, withGame, homeStar, tap, selectHome, savedGame };
