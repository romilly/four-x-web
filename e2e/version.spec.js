const { test, expect, openGame } = require('./fixtures');
const { version } = require('../package.json');

test('the version shows where a screenshot will catch it', async ({ page }) => {
  await openGame(page);
  const phone = await page.evaluate(() => innerWidth <= 430);
  if (phone) await expect(page.locator('.brand')).toBeHidden();
  else await expect(page.locator('.brand')).toContainText(`v${version}`);
  await expect(page.locator('.verfoot')).toHaveText(`Gabriel's Reach v${version}`);
  await page.locator('#helpBtn').click();
  await expect(page.locator('#seedLine')).toContainText(`Version ${version}`);
});
