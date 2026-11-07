const { test, expect, openGame, withGame } = require('./fixtures');

const scores = page => page.evaluate(() => JSON.parse(localStorage.getItem('gr-scores-1') || 'null'));
const cell = (page, d, z) => page.locator(`#scoreTable td[data-d="${d}"][data-z="${z}"]`);
// A Normal, small galaxy with every rival already gone: ending the turn wins it.
const aboutToWin = withGame(() => {
  const g = newGame(777, 'normal', 'small', 'total');
  for (const p of g.planets) if (p.owner > 0) { p.owner = -1; p.pop = 0; }
  g.fleets = g.fleets.filter(f => f.owner === 0);
  return g;
});
const midGame = (turn, difficulty = 'hard', size = 'medium') =>
  withGame(`() => { const g = newGame(31337, '${difficulty}', '${size}', 'total'); g.turn = ${turn}; return g; }`);
async function scoresTab(page) {
  await page.locator('#helpBtn').click();
  await page.locator('#helpModal [data-tab="scores"]').click();
}
async function newGameFromHelp(page, level = 'easy') {
  await page.locator('#helpBtn').click();
  await page.locator('#helpModal [data-tab="game"]').click();
  await page.locator(`#helpModal [data-diff="${level}"]`).click();
  if (await page.locator('#helpModal').isVisible()) await page.locator(`#helpModal [data-diff="${level}"]`).click();
}

test('a win is counted once, even after a reload', async ({ page }) => {
  await openGame(page, aboutToWin);
  await page.locator('#end').click();
  await expect(page.locator('#overModal')).toBeVisible();
  expect((await scores(page)).normal.small).toEqual({ win: 1, loss: 0, abandoned: 0 });
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.lbl').length > 0);
  await page.locator('#end').click(); // shows the end screen again
  expect((await scores(page)).normal.small.win).toBe(1);
  await page.locator('#overModal [data-close="overModal"]').click();
  await scoresTab(page);
  await expect(cell(page, 'normal', 'small')).toHaveText('1–0–0');
});

test('leaving an unfinished game after turn 1 counts as abandoned', async ({ page }) => {
  await openGame(page, midGame(9, 'hard', 'medium'));
  await newGameFromHelp(page);
  expect((await scores(page)).hard.medium).toEqual({ win: 0, loss: 0, abandoned: 1 });
});

test('leaving on turn 1, or leaving the tutorial, does not count', async ({ page }) => {
  await openGame(page, midGame(1));
  await newGameFromHelp(page);
  expect(await scores(page)).toBeNull();
  await page.locator('#helpBtn').click();
  await page.locator('#helpModal [data-tab="game"]').click();
  await page.locator('#tutRestart').click();
  await page.locator('#end').click(); await page.locator('#end').click(); // the tutorial game reaches turn 3
  await newGameFromHelp(page);
  expect(await scores(page)).toBeNull();
});

test('the Scores tab shows the tally, and Reset clears it after a second tap', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => localStorage.setItem('gr-scores-1', JSON.stringify({ easy: { small: { win: 3, loss: 1, abandoned: 2 } }, impossible: { large: { loss: 4 } } })));
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.lbl').length > 0);
  await scoresTab(page);
  await expect(cell(page, 'easy', 'small')).toHaveText('3–1–2');
  await expect(cell(page, 'impossible', 'large')).toHaveText('0–4–0');
  await expect(cell(page, 'all', 'all')).toHaveText('3–5–2');
  await page.locator('#resetScores').click();
  await expect(page.locator('#scoreNote')).toContainText('Tap again');
  await expect(cell(page, 'easy', 'small')).toHaveText('3–1–2');
  await page.locator('#resetScores').click();
  await expect(cell(page, 'all', 'all')).toHaveText('0–0–0');
  expect((await scores(page)).easy.small).toEqual({ win: 0, loss: 0, abandoned: 0 });
});

test('wins are green, losses red and abandoned games yellow', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => localStorage.setItem('gr-scores-1', JSON.stringify({ normal: { small: { win: 3, loss: 1, abandoned: 2 } } })));
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.lbl').length > 0);
  await scoresTab(page);
  const c = cell(page, 'normal', 'small');
  await expect(c).toHaveText('3–1–2');
  const colour = k => c.locator(`.${k}`).evaluate(e => getComputedStyle(e).color);
  expect(await colour('w')).toBe('rgb(95, 211, 122)');
  expect(await colour('l')).toBe('rgb(240, 90, 90)');
  expect(await colour('a')).toBe('rgb(245, 213, 71)');
  await expect(cell(page, 'all', 'all').locator('.w')).toHaveText('3');
});
