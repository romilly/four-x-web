const { test, expect, openGame, savedGame } = require('./fixtures');

test('the Game tab offers four levels, easiest first, and describes each', async ({ page }) => {
  await openGame(page);
  await page.locator('#helpBtn').click();
  await page.locator('#helpModal [data-tab="game"]').click();
  await expect(page.locator('#helpModal [data-diff]')).toHaveText(['Easy', 'Normal', 'Hard', 'Impossible']);
  const note = page.locator('#diffNote');
  for (const level of ['Easy', 'Normal', 'Hard', 'Impossible']) await expect(note).toContainText(level);
  await expect(note).toContainText('whole map');
  // all four fit on a phone without scrolling sideways
  const row = page.locator('#helpModal .diffs[data-confirm]');
  expect(await row.evaluate(r => r.scrollWidth <= r.clientWidth)).toBe(true);
});

test('Impossible starts a game against the strongest rivals', async ({ page }) => {
  await openGame(page);
  await page.locator('#helpBtn').click();
  await page.locator('#helpModal [data-tab="game"]').click();
  await page.locator('#helpModal [data-diff="impossible"]').click();
  await expect(page.locator('#diffNote')).toContainText('Tap Impossible again');
  await page.locator('#helpModal [data-diff="impossible"]').click();
  expect((await savedGame(page)).difficulty).toBe('impossible');
  await page.locator('#helpBtn').click();
  await expect(page.locator('#seedLine')).toContainText('Impossible');
});
