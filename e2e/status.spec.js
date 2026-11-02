const { test, expect, openGame, withGame } = require('./fixtures');

test('the Status tab lists every empire with its systems, income and ships', async ({ page }) => {
  await openGame(page, withGame(() => newGame(42, 'hard', 'medium')));
  await page.locator('#helpBtn').click();
  await page.locator('#helpModal [data-tab="status"]').click();
  const rows = page.locator('#statusList .emp');
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText('Aurum Concord');
  const expected = await page.evaluate(() => empireStatus(JSON.parse(localStorage.getItem('gr-save-3')).game));
  for (let i = 0; i < expected.length; i++) {
    const r = expected[i], row = page.locator(`#statusList .emp[data-emp="${r.id}"]`);
    await expect(row).toContainText(r.name);
    for (const k of ['systems', 'income', 'fighter', 'colony', 'scout'])
      await expect(row.locator(`[data-k="${k}"]`)).toHaveText(String(r[k]));
  }
});

test('the Status tab marks fallen empires', async ({ page }) => {
  await openGame(page, withGame(() => { const g = newGame(7); g.empires[2].alive = false; for (const p of g.planets) if (p.owner === 2) p.owner = -1; g.fleets = g.fleets.filter(f => f.owner !== 2); return g; }));
  await page.locator('#helpBtn').click();
  await page.locator('#helpModal [data-tab="status"]').click();
  await expect(page.locator('#statusList .emp[data-emp="2"]')).toContainText('Fallen');
});

test('the About tab names the game and its version and links to the source', async ({ page }) => {
  await openGame(page);
  await page.locator('#helpBtn').click();
  await page.locator('#helpModal [data-tab="about"]').click();
  const about = page.locator('#helpModal [data-panel="about"]');
  await expect(about).toBeVisible();
  await expect(about).toContainText(await page.evaluate(() => GAME_VERSION));
  await expect(about.locator('a[href="https://github.com/romilly/four-x-web"]')).toHaveCount(1);
});
