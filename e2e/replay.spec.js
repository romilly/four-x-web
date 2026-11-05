const { test, expect, openGame, withGame, savedGame } = require('./fixtures');

const SITE = 'https://romilly.github.io/four-x-web/';
const inProgress = withGame(() => {
  const g = newGame(31337, 'hard', 'medium', 'dominance'); g.turn = 9; return g;
});

async function gameTab(page) {
  await page.locator('#helpBtn').click();
  await page.locator('#helpModal [data-tab="game"]').click();
}

test('Restart this galaxy takes the game back to turn 1, after a second tap', async ({ page }) => {
  await openGame(page, inProgress);
  await gameTab(page);
  await page.locator('#restartBtn').click();
  await expect(page.locator('#restartNote')).toContainText('Tap again');
  expect((await savedGame(page)).turn).toBe(9);
  await page.locator('#restartBtn').click();
  await expect(page.locator('#helpModal')).toBeHidden();
  const g = await savedGame(page);
  expect([g.seed, g.size, g.victory, g.difficulty, g.turn]).toEqual([31337, 'medium', 'dominance', 'hard', 1]);
});

test('the Game tab shows a link to this galaxy, to copy or share', async ({ page }) => {
  await openGame(page, inProgress);
  await gameTab(page);
  await expect(page.locator('#galaxyLink')).toHaveValue(`${SITE}?galaxy=31337&size=medium&victory=dominance&difficulty=hard`);
  await expect(page.locator('#copyLink')).toBeVisible();
});

test('after a game ends, Play this galaxy again restarts it straight away', async ({ page }) => {
  await openGame(page, withGame(() => {
    const g = newGame(777, 'normal', 'small', 'total');
    for (const p of g.planets) if (p.owner > 0) { p.owner = -1; p.pop = 0; }
    g.fleets = g.fleets.filter(f => f.owner === 0);
    return g;
  }));
  await page.locator('#end').click();
  await page.locator('#overAgain').click();
  await expect(page.locator('#overModal')).toBeHidden();
  const g = await savedGame(page);
  expect([g.seed, g.turn, g.over]).toEqual([777, 1, null]);
});

test('a galaxy link starts that galaxy when no game is in progress, and tidies the address', async ({ page }) => {
  await page.goto('/?galaxy=4242&size=large&victory=total&difficulty=impossible');
  await page.waitForFunction(() => document.querySelectorAll('.lbl').length > 0);
  const g = await savedGame(page);
  expect([g.seed, g.size, g.victory, g.difficulty, g.turn]).toEqual([4242, 'large', 'total', 'impossible', 1]);
  expect(new URL(page.url()).search).toBe('');
  await expect(page.locator('#linkModal')).toBeHidden();
});

test('a galaxy link asks before replacing a game in progress', async ({ page }) => {
  await openGame(page, inProgress);
  await page.goto('/?galaxy=4242');
  await expect(page.locator('#linkModal')).toBeVisible();
  await expect(page.locator('#linkText')).toContainText('galaxy 4242');
  await expect(page.locator('#linkText')).toContainText('turn 9');
  await page.locator('#linkKeep').click();
  await expect(page.locator('#linkModal')).toBeHidden();
  expect((await savedGame(page)).seed).toBe(31337);

  await page.goto('/?galaxy=4242');
  await page.locator('#linkPlay').click();
  await expect(page.locator('#linkModal')).toBeHidden();
  const g = await savedGame(page);
  expect([g.seed, g.size, g.difficulty, g.turn]).toEqual([4242, 'small', 'normal', 1]);
});

test('a damaged galaxy link is ignored', async ({ page }) => {
  await openGame(page, inProgress);
  await page.goto('/?galaxy=4242&difficulty=brutal');
  await page.waitForFunction(() => document.querySelectorAll('.lbl').length > 0);
  await expect(page.locator('#linkModal')).toBeHidden();
  expect((await savedGame(page)).seed).toBe(31337);
});
