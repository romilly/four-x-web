const { test, expect, openGame, tap } = require('./fixtures');

const step = page => page.locator('#coachStep');
const next = page => page.locator('#coachNext').click();

test('the tutorial can be played from start to finish', async ({ page }) => {
  await openGame(page);
  await page.locator('#helpBtn').click();
  await page.locator('#tutCall [data-tut="start"]').click();
  await expect(step(page)).toHaveText(/step 1 of 16/);
  await next(page);

  // Steps 2-6: select home, enter the system, pick the rich planet, colonise, end turn
  await expect(step(page)).toHaveText(/step 2 of/);
  const label = page.locator('.lbl.coach-target');
  const box = await label.boundingBox();
  await tap(page, { x: box.x + box.width / 2, y: box.y - 12 });
  await expect(step(page)).toHaveText(/step 3 of/);
  await page.locator('[data-act="enter"]').click();
  await expect(step(page)).toHaveText(/step 4 of/);
  await page.locator('.prow.coach-target').click();
  await expect(step(page)).toHaveText(/step 5 of/);
  await page.locator('[data-act="colonise"]').click();
  await expect(step(page)).toHaveText(/step 6 of/);
  await page.locator('#end').click();
  await expect(page.locator('.log')).toContainText('New colony founded');
  await next(page);

  // Steps 8-11: back to the galaxy, send the scout on its own
  await page.locator('[data-act="exit"]').click();
  await expect(step(page)).toHaveText(/step 9 of/);
  await page.locator('[data-act="send"]').click();
  while (await page.locator('[data-act="dec"][data-type="fighter"]:not([disabled])').count()) await page.locator('[data-act="dec"][data-type="fighter"]').click();
  await page.locator('[data-act="target"]').click();
  await expect(step(page)).toHaveText(/step 11 of/);
  const dest = await page.evaluate(() => {
    for (const l of document.querySelectorAll('.lbl')) {
      if (l.style.visibility !== 'visible' || l.classList.contains('coach-target')) continue;
      const r = l.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y - 12, e = document.elementFromPoint(x, y);
      if (e && e.id === 'gl' && l.firstChild && l.firstChild.style.color !== 'rgb(242, 181, 68)') return { x, y };
    }
  });
  await tap(page, dest);

  // Steps 12-14: build a fighter, look at research, end the turn
  await expect(step(page)).toHaveText(/step 12 of/);
  await page.locator('[data-act="build"][data-type="fighter"]').click();
  await expect(step(page)).toHaveText(/step 13 of/);
  await page.locator('#techBtn').click();
  await expect(step(page)).toHaveText(/step 14 of/);
  await page.locator('#techModal [data-close]').click();
  await page.locator('#end').click();
  await expect(step(page)).toHaveText(/step 15 of/);
  await next(page);
  await expect(step(page)).toHaveText(/step 16 of/);
  await next(page);
  await expect(page.locator('#coach')).toBeHidden();
  await expect(page.locator('#turn')).toHaveText('3');
});
