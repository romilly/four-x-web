const fs = require('fs');
const { test, expect, openGame, savedGame } = require('./fixtures');

test('a game saved as YAML loads back exactly', async ({ page }, info) => {
  await openGame(page);
  for (let i = 0; i < 2; i++) await page.locator('#end').click();
  const before = await savedGame(page);
  await page.locator('#helpBtn').click();
  await page.locator('[data-tab="game"]').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#saveBtn').click()]);
  const file = info.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  expect(fs.readFileSync(file, 'utf8')).toMatch(/^format: gabriels-reach-save$/m);

  await page.locator('#helpModal [data-diff="easy"]').click();
  await page.locator('#helpModal [data-diff="easy"]').click();
  expect((await savedGame(page)).seed).not.toBe(before.seed);

  await page.locator('#helpBtn').click();
  await page.locator('[data-tab="game"]').click();
  await page.locator('#loadFile').setInputFiles(file);
  await expect(page.locator('#loadSummary')).toContainText(`galaxy ${before.seed}`);
  await page.locator('#loadGo').click();
  expect(await savedGame(page)).toEqual(before);
});

test('files that are not saves, or come from a newer version, are refused with a reason', async ({ page }, info) => {
  await openGame(page);
  await page.locator('#helpBtn').click();
  await page.locator('[data-tab="game"]').click();
  const notes = info.outputPath('notes.yaml');
  fs.writeFileSync(notes, 'shopping:\n  - eggs\n');
  await page.locator('#loadFile').setInputFiles(notes);
  await expect(page.locator('#saveNote')).toHaveText("This file isn't a Gabriel's Reach save.");
  const future = info.outputPath('future.yaml');
  fs.writeFileSync(future, 'format: gabriels-reach-save\nversion: 99\ngame: {}\n');
  await page.locator('#loadFile').setInputFiles(future);
  await expect(page.locator('#saveNote')).toContainText('newer version of the game');
});
