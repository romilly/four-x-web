const { test, expect, openGame, withGame, selectHome } = require('./fixtures');

test.describe('first visit', () => {
  test.use({ firstVisit: true });

  test('only the help panel opens, offering the tutorial, and closing it frees the map', async ({ page }) => {
    // Outside Claude's viewer (GitHub Pages) every dialog once showed at once and blocked all clicks.
    await openGame(page);
    await expect(page.locator('.modal:visible')).toHaveCount(1);
    await expect(page.locator('#helpModal')).toBeVisible();
    await expect(page.locator('#tutCall')).toBeVisible();
    await page.locator('#helpModal [data-close]').first().click();
    await expect(page.locator('.modal:visible')).toHaveCount(0);
    await selectHome(page);
  });
});

test('a game autosaved before galaxy sizes existed still opens', async ({ page }) => {
  await openGame(page, withGame(() => { const g = newGame(5); delete g.size; delete g.victory; return g; }));
  await page.locator('#helpBtn').click();
  await expect(page.locator('#seedLine')).toContainText('Galaxy 5 · Small · Total victory');
});
