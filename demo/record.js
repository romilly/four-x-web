// Records a short demo of Gabriel's Reach: `npm run demo`.
// Plays a scripted opening in the tutorial galaxy, then shows a large galaxy, recording the browser as it goes.
// Writes demo-output/gabriels-reach.webm; with ffmpeg installed, also an .mp4 and a small .gif for the README.
const { chromium } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const { serveGame, GAME_URL } = require('../e2e/serve');

const OUT = path.join(__dirname, '..', 'demo-output');
const SIZE = { width: 1280, height: 720 };

// Shows a gold ripple wherever the demo clicks, so viewers can follow along.
function showTaps() {
  addEventListener('pointerdown', e => {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;
      border:3px solid #f2b544;pointer-events:none;z-index:99;transition:transform .6s ease-out,opacity .6s ease-out`;
    document.body.appendChild(d);
    requestAnimationFrame(() => { d.style.transform = 'scale(1.9)'; d.style.opacity = '0'; });
    setTimeout(() => d.remove(), 700);
  }, true);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: OUT, size: SIZE } });
  const page = await context.newPage();
  await serveGame(page);
  await page.addInitScript(showTaps);
  await page.addInitScript(() => { try { localStorage.setItem('gr-help-3', '1'); } catch (e) {} });
  const pause = ms => page.waitForTimeout(ms);
  const click = async sel => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await pause(250); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
  const clickAt = async ({ x, y }) => { await page.mouse.move(x, y, { steps: 10 }); await pause(250); await page.mouse.click(x, y); };
  const star = name => page.evaluate(n => { const l = [...document.querySelectorAll('.lbl')].find(l => l.firstChild && l.firstChild.textContent === n); const r = l.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y - 12 }; }, name);

  // The tutorial galaxy, without the coach strip
  await page.goto(GAME_URL);
  await page.evaluate(() => { localStorage.setItem('gr-save-3', JSON.stringify({ game: newGame(33, 'easy'), pending: [] })); localStorage.removeItem('gr-tut-1'); });
  await page.reload(); await pause(1500);
  await clickAt(await star('Yed')); await pause(1200);
  await click('[data-act="enter"]'); await pause(1800);
  await click('.prow:has-text("habitability 6")'); await pause(1000);
  await click('[data-act="colonise"]'); await pause(1000);
  await click('#end'); await pause(1800);
  await click('[data-act="exit"]'); await pause(1000); // Yed stays selected, so its fleet is in the orders panel
  await click('[data-act="send"]'); await pause(600);
  await click('[data-act="dec"][data-type="fighter"]'); await pause(250);
  await click('[data-act="dec"][data-type="fighter"]'); await pause(500);
  await click('[data-act="target"]'); await pause(800);
  // the scout's destination: an uncharted star that is in view and not behind the orders panel
  await clickAt(await page.evaluate(() => {
    for (const l of document.querySelectorAll('.lbl.unk')) {
      if (l.style.visibility !== 'visible') continue;
      const r = l.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y - 12, e = document.elementFromPoint(x, y);
      if (e && e.id === 'gl') return { x, y };
    }
  })); await pause(800);
  await click('[data-act="build"][data-type="fighter"]'); await pause(800);
  await click('#end'); await pause(1200);
  await click('#end'); await pause(1500);

  // A large galaxy: seven empires, dominance victory
  await click('#helpBtn'); await pause(800);
  await click('[data-tab="game"]'); await pause(600);
  await click('[data-pick="size"] [data-val="large"]'); await pause(400);
  await click('[data-pick="victory"] [data-val="dominance"]'); await pause(600);
  await click('#helpModal [data-diff="normal"]'); await pause(400);
  await click('#helpModal [data-diff="normal"]'); await pause(1200);
  await page.mouse.move(640, 300); await page.mouse.down(); await page.mouse.move(820, 250, { steps: 30 }); await page.mouse.up(); await pause(800);
  await page.mouse.wheel(0, 900); await pause(2500);

  const video = page.video();
  await context.close(); await browser.close();
  const webm = path.join(OUT, 'gabriels-reach.webm');
  fs.renameSync(await video.path(), webm);
  console.log('Wrote', webm);

  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { console.log('ffmpeg not found: skipping .mp4 and .gif'); return; }
  const mp4 = path.join(OUT, 'gabriels-reach.mp4'), gif = path.join(OUT, 'gabriels-reach.gif');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-vf',
    'fps=7,scale=560:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', gif]);
  console.log('Wrote', mp4, 'and', gif);
})();
