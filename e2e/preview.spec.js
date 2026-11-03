// Link previews: what chat apps, email and social sites show when someone pastes the game's link.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('./fixtures');

const SITE = 'https://romilly.github.io/four-x-web/';
// Width and height from a JPEG's start-of-frame marker.
function jpegSize(b) {
  for (let i = 2; i < b.length;) {
    const marker = b[i + 1], len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return null;
}
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
  // A JPEG under 200 KB: WhatsApp is widely reported to skip preview images over about 300 KB.
  const jpg = fs.readFileSync(file);
  expect(jpg.readUInt16BE(0)).toBe(0xffd8);
  expect(jpegSize(jpg)).toEqual([1200, 630]);
  expect(jpg.length).toBeLessThan(200_000);
  expect(await meta(page, 'property', 'og:image:type')).toBe('image/jpeg');
  expect(await meta(page, 'property', 'og:image:width')).toBe('1200');
  expect(await meta(page, 'property', 'og:image:height')).toBe('630');
  expect((await meta(page, 'property', 'og:image:alt')).length).toBeGreaterThan(20);
});
