const { test, expect, openGame, withGame, savedGame } = require('./fixtures');

test('a game autosaved before 3D galaxies opens as a flat galaxy', async ({ page }) => {
  await openGame(page, withGame(() => { const g = newGame(5); for (const st of g.stars) delete st.z; return g; }));
  await page.locator('#end').click();
  expect((await savedGame(page)).stars.every(st => st.z === 0)).toBe(true);
});

test('Basics lists the rivals still in the game, and the fallen', async ({ page }) => {
  await openGame(page, withGame(() => {
    const g = newGame(5, 'normal', 'medium');
    g.empires[2].alive = false;
    for (const p of g.planets) if (p.owner === 2) { p.owner = -1; p.pop = 0; }
    g.fleets = g.fleets.filter(f => f.owner !== 2);
    return g;
  }));
  await page.locator('#helpBtn').click();
  await expect(page.locator('#thisGame')).toContainText('Medium galaxy, 48 stars · Total victory · Normal rivals');
  await expect(page.locator('#rivalList')).toContainText('Three rivals remain');
  await expect(page.locator('#rivalList')).toContainText('Fallen: Ossari Choir.');
});

test('Basics states the general rules even in a default small game', async ({ page }) => {
  await openGame(page);
  await page.locator('#helpBtn').click();
  const basics = page.locator('[data-panel="basics"] ul');
  await expect(basics).toContainText('2, 4 or 6 rival empires');
  await expect(basics).toContainText('Total victory');
  await expect(basics).toContainText('Dominance');
  await expect(page.locator('#thisGame')).toContainText('Small galaxy, 28 stars · Total victory');
});
