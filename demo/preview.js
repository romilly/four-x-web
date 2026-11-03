// Makes the link-preview image, docs/preview.jpg (1200 x 630, a JPEG kept well under WhatsApp's reported 300 KB limit): `npm run preview`.
// It is what chat apps, email and social sites show when someone pastes the game's link (the og:image in index.html).
// A large galaxy, played for some turns by the rivals' own AI on every side so the empires have spread, fully charted,
// with a title card over the left. The game's fonts come from node_modules, so no network is needed.
const { chromium } = require('@playwright/test');
const fs = require('fs'), path = require('path');
const { serveGame, GAME_URL } = require('../e2e/serve');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'preview.jpg');
const SEED = 2026, TURNS = 28;

const FONTS = [
  ['Michroma', 400, '@fontsource/michroma/files/michroma-latin-400-normal.woff2'],
  ['IBM Plex Sans Condensed', 400, '@fontsource/ibm-plex-sans-condensed/files/ibm-plex-sans-condensed-latin-400-normal.woff2'],
  ['IBM Plex Sans Condensed', 600, '@fontsource/ibm-plex-sans-condensed/files/ibm-plex-sans-condensed-latin-600-normal.woff2'],
  ['IBM Plex Mono', 500, '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2'],
];
const fontCss = FONTS.map(([family, weight, file]) =>
  `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;src:url(http://game.test/node_modules/${file}) format('woff2')}`).join('\n');

// Runs in the page: a galaxy several turns in, with everything charted so stars show their names.
function setUp({ SEED, TURNS }) {
  let s = newGame(SEED, 'normal', 'large');
  const rng = makeRng(s.rngState);
  for (let t = 0; t < TURNS && !s.over; t++) {
    const orders = {};
    for (const e of s.empires) if (e.alive) orders[e.id] = aiOrders(sightOf(s, e.id), e.id, rng);
    s = resolveTurn(s, orders, rng).state;
    s.rngState = rng.state;
  }
  s.intel[0] = { stars: s.stars.map(() => true), planets: s.planets.map(p => ({ owner: p.owner, pop: p.pop })) };
  s.events = [];
  localStorage.setItem('gr-save-3', JSON.stringify({ game: s, pending: [] }));
}

// Runs in the page: hides the interface and lays a title card over the left of the map.
function titleCard() {
  for (const id of ['hud', 'sheet']) document.getElementById(id).style.display = 'none';
  const card = document.createElement('div');
  card.innerHTML = `
    <div class="k">A turn-based space 4X · free in your browser</div>
    <h1>Gabriel's<br>Landing</h1>
    <p>Explore a three-dimensional star cluster. Settle colonies, research, and out-fight up to six rival empires.</p>
    <div class="u">romilly.github.io/four-x-web</div>`;
  card.style.cssText = 'position:fixed;inset:0 auto 0 0;width:640px;z-index:30;display:flex;flex-direction:column;justify-content:center;' +
    'padding:0 0 0 64px;background:linear-gradient(90deg,#060913 0%,#060913 55%,rgba(6,9,19,.75) 78%,rgba(6,9,19,0) 100%);pointer-events:none';
  const style = document.createElement('style');
  style.textContent = `
    #pv .k{font:500 15px 'IBM Plex Mono',monospace;letter-spacing:.06em;color:#8d97b5}
    #pv h1{margin:22px 0 26px;font:400 58px/1.12 Michroma,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#f2b544}
    #pv p{margin:0;max-width:430px;font:400 24px/1.4 'IBM Plex Sans Condensed',sans-serif;color:#e6e9f2}
    #pv .u{margin-top:34px;font:500 16px 'IBM Plex Mono',monospace;color:#4fd1c5}`;
  card.id = 'pv';
  document.head.appendChild(style);
  document.body.appendChild(card);
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await serveGame(page);
  // Registered after serveGame, so these take precedence: the game's Google Fonts request, answered from node_modules.
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: fontCss, contentType: 'text/css' }));
  await page.route('http://game.test/node_modules/@fontsource/**', route =>
    route.fulfill({ path: path.join(ROOT, new URL(route.request().url()).pathname.slice(1)), contentType: 'font/woff2' }));
  await page.addInitScript(() => { try { localStorage.setItem('gr-help-3', '1'); } catch (e) {} });

  await page.goto(GAME_URL);
  await page.waitForFunction(() => document.querySelectorAll('.lbl').length > 0);
  await page.evaluate(setUp, { SEED, TURNS });
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.lbl').length > 0);
  // Zoom out and pan with the game's own mouse controls until the whole cluster sits in the right-hand part of the image.
  const labels = () => page.evaluate(() => {
    const r = [...document.querySelectorAll('.lbl')].map(l => l.getBoundingClientRect()).filter(r => r.width);
    const x = r.map(b => b.x + b.width / 2), y = r.map(b => b.y);
    return { x0: Math.min(...x), x1: Math.max(...x), y0: Math.min(...y), y1: Math.max(...y) };
  });
  await page.mouse.move(900, 315);
  for (let i = 0; i < 40; i++) {
    const b = await labels();
    if (b.x1 - b.x0 < 470 && b.y1 - b.y0 < 460) break;
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(120);
  }
  for (let i = 0; i < 4; i++) {
    const b = await labels(), dx = 890 - (b.x0 + b.x1) / 2, dy = 320 - (b.y0 + b.y1) / 2;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) break;
    await page.mouse.move(700, 315); await page.mouse.down();
    await page.mouse.move(700 + dx, 315 + dy, { steps: 12 }); await page.mouse.up();
    await page.waitForTimeout(400);
  }
  await page.evaluate(titleCard);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 85 });
  await browser.close();
  console.log(`Wrote ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
})();
