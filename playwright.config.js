// Browser tests for Gabriel's Reach. Run with `npm run e2e`.
// The game is served from local files, with its CDN libraries (three.js, js-yaml) answered from node_modules,
// so the tests need no web server and no network.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.js',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://game.test/',
    trace: 'retain-on-failure',
    // Software WebGL, so the 3D map renders on machines without a GPU (including GitHub's runners).
    launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
