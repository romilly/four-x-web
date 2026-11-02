const { test, expect, openGame, selectHome } = require('./fixtures');

test('on desktop the orders panel can use most of the screen height', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the side panel is a desktop layout');
  await openGame(page);
  const room = await page.evaluate(() => {
    const s = document.getElementById('sheet');
    s.style.height = '5000px'; // max-height clamps this to the room the panel is allowed
    const max = s.getBoundingClientRect().height;
    s.style.height = '';
    return { max, screen: innerHeight };
  });
  expect(room.max).toBeGreaterThan(room.screen * 0.8);
});

test('‹ Galaxy stays in view when the system panel is scrolled', async ({ page }) => {
  await openGame(page);
  await selectHome(page);
  await page.locator('[data-act="enter"]').click();
  const exit = page.locator('[data-act="exit"]');
  await expect(exit).toBeVisible();
  await page.locator('#sheetBody').evaluate(b => { b.scrollTop = b.scrollHeight; });
  await expect(exit).toBeInViewport({ ratio: 1 });
  await exit.click();
  await expect(page.locator('[data-act="enter"]')).toBeVisible();
});

test('help tabs are stacked vertically and never scroll sideways', async ({ page }) => {
  await openGame(page);
  await page.locator('#helpBtn').click();
  const tabs = page.locator('#helpModal [role="tablist"]');
  await expect(tabs).toHaveAttribute('aria-orientation', 'vertical');
  const boxes = await page.locator('#helpModal [role="tab"]').evaluateAll(bs => bs.map(b => b.getBoundingClientRect()).map(r => ({ x: r.x, y: r.y })));
  for (let i = 1; i < boxes.length; i++) {
    expect(boxes[i].x).toBeCloseTo(boxes[0].x, 0);
    expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);
  }
  expect(await tabs.evaluate(t => t.scrollWidth <= t.clientWidth)).toBe(true);
  await page.locator('#helpModal [data-tab="controls"]').click();
  await expect(page.locator('#helpModal [data-panel="controls"]')).toBeVisible();
});
