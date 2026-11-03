// Makes the link-preview image, docs/preview.jpg (1200 x 630, a JPEG kept well under WhatsApp's reported 300 KB limit): `npm run preview`.
// It is what chat apps, email and social sites show when someone pastes the game's link (the og:image in index.html).
// A medium galaxy, played for some turns by the rivals' own AI on every side so the empires have spread, fully charted,
// with the title above it. WhatsApp shows the image as a square cut from the middle (x 285 to 915), so the title
// and the whole cluster stay inside that square; the wide image just shows more starfield either side. The game's fonts come from node_modules, so no network is needed.
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
  let s = newGame(SEED, 'normal', 'medium');
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

// Runs in the page: hides the interface and puts the title across the top, centred.
function titleCard() {
  for (const id of ['hud', 'sheet']) document.getElementById(id).style.display = 'none';
  const card = document.createElement('div');
  card.id = 'pv';
  card.innerHTML = `<h1>Gabriel's<br>Landing</h1><div class="k">A space 4X · free in your browser</div>`;
  card.style.cssText = 'position:fixed;left:0;right:0;top:0;height:215px;z-index:30;display:flex;flex-direction:column;align-items:center;' +
    'justify-content:flex-start;padding-top:30px;text-align:center;pointer-events:none;' +
    'background:linear-gradient(180deg,#060913 0%,#060913 80%,rgba(6,9,19,0) 100%)';
  const style = document.createElement('style');
  style.textContent = `
    #pv h1{margin:0 0 12px;font:400 48px/1.18 Michroma,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#f2b544}
    #pv .k{font:500 17px 'IBM Plex Mono',monospace;letter-spacing:.04em;color:#8d97b5}`;
  document.head.appendChild(style);
  document.body.appendChild(card);
}

// The square WhatsApp keeps, with a margin: everything that matters must fall inside it.
const SAFE = { x0: 315, x1: 885 };

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
  // Zoom out and pan with the game's own mouse controls until the whole cluster sits below the title, in the middle.
  const labels = () => page.evaluate(() => {
    const r = [...document.querySelectorAll('.lbl')].map(l => l.getBoundingClientRect()).filter(r => r.width);
    const x = r.map(b => b.x + b.width / 2), y = r.map(b => b.y);
    return { x0: Math.min(...x), x1: Math.max(...x), y0: Math.min(...y), y1: Math.max(...y) };
  });
  await page.mouse.move(600, 420);
  // Zoom all the way out (the game caps how far), then pan the cluster to the middle, below the title.
  // The camera eases into each move, so wait for it to settle before measuring. Off-screen labels are not counted.
  await page.mouse.move(600, 420);
  for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(60); }
  await page.waitForTimeout(1500);
  for (let i = 0; i < 5; i++) {
    const b = await labels(), dx = 600 - (b.x0 + b.x1) / 2, dy = 412 - (b.y0 + b.y1) / 2;
    if (process.env.DEBUG) console.log('frame', i, JSON.stringify(b));
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) break;
    await page.mouse.move(600, 315); await page.mouse.down();
    await page.mouse.move(600 + dx, 315 + dy, { steps: 12 }); await page.mouse.up();
    await page.waitForTimeout(1000);
  }
  const b = await labels();
  if (b.x0 < SAFE.x0 || b.x1 > SAFE.x1 || b.y0 < 215 || b.y1 > 605) throw new Error(`the cluster does not fit the square crop: ${JSON.stringify(b)}`);
  await page.evaluate(titleCard);
  const t = await page.evaluate(() => { const r = document.querySelector('#pv h1').getBoundingClientRect(); return { x0: r.x, x1: r.right }; });
  if (t.x0 < SAFE.x0 || t.x1 > SAFE.x1) throw new Error(`the title does not fit the square crop: ${JSON.stringify(t)}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 85 });
  await browser.close();
  console.log(`Wrote ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
})();
