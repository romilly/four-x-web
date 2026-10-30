// Serve the game from this repository inside a Playwright page: the game's own files from disk, its CDN libraries
// (three.js, js-yaml) from node_modules. No web server and no network are needed. Used by the tests and the demo.
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCAL = [
  [/three\.min\.js$/, 'node_modules/three/build/three.min.js'],
  [/OrbitControls\.js$/, 'node_modules/three/examples/js/controls/OrbitControls.js'],
  [/js-yaml\.min\.js$/, 'node_modules/js-yaml/dist/js-yaml.min.js'],
];
const GAME_URL = 'http://game.test/';

async function serveGame(page) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    for (const [pattern, file] of LOCAL) if (pattern.test(url.pathname)) return route.fulfill({ path: path.join(ROOT, file), contentType: 'text/javascript' });
    if (url.host === 'game.test') {
      const file = path.join(ROOT, url.pathname.slice(1) || 'index.html');
      return route.fulfill({ path: file, contentType: file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' });
    }
    return route.abort(); // fonts and anything else: the game must work without them
  });
}

module.exports = { serveGame, GAME_URL };
