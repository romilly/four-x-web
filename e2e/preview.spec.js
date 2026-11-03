// Link previews: what chat apps, email and social sites show when someone pastes the game's link.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('./fixtures');

const SITE = 'https://romilly.github.io/four-x-web/';
const meta = (page, attr, name) => page.locator(`head meta[${attr}="${name}"]`).getAttribute('content');

test('the page describes itself for link previews', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the page head is the same at every size');
  await page.goto('/');
  const description = await meta(page, 'name', 'description');
  expect(description.length).toBeGreaterThan(50);
  expect(description.length).toBeLessThanOrEqual(160);
  expect(await meta(page, 'property', 'og:title')).toBe("Gabriel's Landing");
  expect(await meta(page, 'property', 'og:description')).toBe(description);
  expect(await meta(page, 'property', 'og:type')).toBe('website');
  expect(await meta(page, 'property', 'og:url')).toBe(SITE);
  expect(await meta(page, 'name', 'twitter:card')).toBe('summary_large_image');

  // The image must be an absolute address on the site, pointing at a file in this repository, 1200 x 630.
  const image = await meta(page, 'property', 'og:image');
  expect(image.startsWith(SITE)).toBe(true);
  const file = path.join(__dirname, '..', image.slice(SITE.length));
  const png = fs.readFileSync(file);
  expect(png.toString('ascii', 1, 4)).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  expect(png.length).toBeLessThan(1_000_000);
  expect(await meta(page, 'property', 'og:image:width')).toBe('1200');
  expect(await meta(page, 'property', 'og:image:height')).toBe('630');
  expect((await meta(page, 'property', 'og:image:alt')).length).toBeGreaterThan(20);
});
