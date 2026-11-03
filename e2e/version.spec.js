const { test, expect, openGame } = require('./fixtures');
const { version } = require('../package.json');

test('the version shows where a screenshot will catch it', async ({ page }) => {
  await openGame(page);
  const phone = await page.evaluate(() => innerWidth <= 430);
  if (phone) await expect(page.locator('.brand')).toBeHidden();
  else await expect(page.locator('.brand')).toContainText(`v${version}`);
  await expect(page.locator('.verfoot')).toHaveText(`Gabriel's Landing v${version}`);
  await page.locator('#helpBtn').click();
  await expect(page.locator('#seedLine')).toContainText(`Version ${version}`);
});

test('the game is called Gabriel\'s Landing everywhere it names itself', async ({ page }) => {
  await openGame(page);
  await expect(page).toHaveTitle("Gabriel's Landing");
  await expect(page.locator('.brand')).toContainText("Gabriel's Landing");
  await page.locator('#helpBtn').click();
  await expect(page.locator('#helpH')).toHaveText("Gabriel's Landing");
  expect(await page.locator('body').innerText()).not.toContain("Gabriel's Reach");
});
