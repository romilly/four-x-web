const { test, expect, openGame, withGame, selectHome, homeStar, tap, savedGame } = require('./fixtures');

test('two colony ships in one fleet settle two planets in the same turn', async ({ page }) => {
  await openGame(page, withGame(() => { const g = newGame(TUTORIAL_SEED); g.fleets.find(f => f.owner === 0).ships.push({ id: 99, type: 'colony' }); return g; }));
  await selectHome(page);
  await page.locator('[data-act="enter"]').click();
  const free = page.locator('.prow', { hasText: 'Free' });
  await expect(free).toHaveCount(2);
  for (const id of await free.evaluateAll(rows => rows.map(r => r.dataset.planet))) {
    await page.locator(`.prow[data-planet="${id}"]`).click();
    await page.locator('[data-act="colonise"]').click();
  }
  await page.locator('#end').click();
  await expect(page.locator('.log li', { hasText: 'New colony founded' })).toHaveCount(2);
});

test('taps on the map keep working after drags that end over the orders panel', async ({ page }) => {
  await openGame(page);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      const c = document.getElementById('gl'), r = document.getElementById('sheet').getBoundingClientRect();
      const ev = (type, el, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, isPrimary: true, clientX: x, clientY: y, bubbles: true }));
      ev('pointerdown', c, 200, 200); ev('pointermove', c, 230, 260); ev('pointerup', document.getElementById('sheet'), r.x + 20, r.y + 20);
    });
    await selectHome(page);
    await page.locator('[data-act="deselect"]').click();
  }
});

test('a full shipyard refuses more ships this turn', async ({ page }) => {
  await openGame(page, withGame(() => { const g = newGame(TUTORIAL_SEED); g.empires[0].credits = 120; g.planets.find(p => p.owner === 0).pop = 5; return g; }));
  await selectHome(page);
  await expect(page.locator('.slots b')).toHaveText('0 of 2');
  await page.locator('[data-act="build"][data-type="fighter"]').click();
  await page.locator('[data-act="build"][data-type="fighter"]').click();
  await expect(page.locator('.slots b')).toHaveText('2 of 2');
  await expect(page.locator('[data-act="build"][data-type="fighter"]')).toBeDisabled();
  await page.locator('#end').click();
  await expect(page.locator('.log li.build')).toHaveCount(1);
  await expect(page.locator('.log li.build')).toHaveText(/^2 fighters created at [A-Za-z]+ and joined Fleet 1\.$/);
});

test('entering a system and returning to the galaxy', async ({ page }) => {
  await openGame(page);
  await selectHome(page);
  await page.locator('[data-act="enter"]').click();
  await expect(page.locator('[data-act="exit"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-act="enter"]')).toBeVisible();
});

test('a large galaxy with dominance victory starts and plays', async ({ page }) => {
  await openGame(page);
  await page.locator('#helpBtn').click();
  await page.locator('[data-tab="game"]').click();
  await page.locator('[data-pick="size"] [data-val="large"]').click();
  await page.locator('[data-pick="victory"] [data-val="dominance"]').click();
  await page.locator('#helpModal [data-diff="normal"]').click();
  await page.locator('#helpModal [data-diff="normal"]').click(); // second tap confirms abandoning the current game
  const g = await savedGame(page);
  expect([g.size, g.victory, g.stars.length, g.empires.length]).toEqual(['large', 'dominance', 72, 7]);
  await expect(page.locator('#domStat')).toBeVisible();
  for (let i = 0; i < 5; i++) await page.locator('#end').click();
  await expect(page.locator('#turn')).toHaveText('6');
});
