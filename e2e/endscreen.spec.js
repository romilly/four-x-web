const { test, expect, openGame, withGame, savedGame } = require('./fixtures');

test('after a win, New game… opens the Game tab and starts a game without asking to abandon', async ({ page }) => {
  // Every rival has already lost its planets and ships, so ending the turn wins.
  await openGame(page, withGame(() => {
    const g = newGame(TUTORIAL_SEED);
    for (const p of g.planets) if (p.owner > 0) { p.owner = -1; p.pop = 0; }
    g.fleets = g.fleets.filter(f => f.owner === 0);
    return g;
  }));
  await page.locator('#end').click();
  await expect(page.locator('#overH')).toHaveText('The Reach is yours');
  await expect(page.locator('#overModal [data-diff]')).toHaveCount(0);
  await page.locator('#overNew').click();
  await expect(page.locator('#overModal')).toBeHidden();
  await expect(page.locator('#helpModal [data-panel="game"]')).toBeVisible();
  await page.locator('[data-pick="size"] [data-val="medium"]').click();
  await page.locator('#helpModal [data-diff="hard"]').click(); // one tap: the finished game needs no confirmation
  const g = await savedGame(page);
  expect([g.size, g.difficulty, g.turn, g.over]).toEqual(['medium', 'hard', 1, null]);
});
