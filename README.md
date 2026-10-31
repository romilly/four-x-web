# Gabriel's Reach

A small turn-based space 4X in the browser, rendered with three.js.
Explore a fogged, three-dimensional star cluster, split and merge fleets, settle colonies,
research, and out-fight up to six scripted rivals.

![A short demo: colonising a planet, sending a scout, then a large galaxy](docs/demo.gif)

## Play

**Play it in your browser: https://romilly.github.io/four-x-web/**

New players are offered a short tutorial on their first visit. You can also open `index.html` from a copy of
this repository; it loads three.js and js-yaml from CDNs, so it needs a connection.

- Touch: drag to pan, pinch to zoom, drag with two fingers to rotate.
- Mouse: drag to pan, scroll to zoom, right-drag or Shift-drag to rotate.

## New games

Under **?** → Game, choose a galaxy size and a victory condition, then tap a difficulty to start.

| Size | Stars | Empires |
|---|---|---|
| Small | 28 | 3 |
| Medium | 48 | 5 |
| Large | 72 | 7 |

- **Total victory:** be the last empire standing.
- **Dominance:** hold 60% of all habitable planets, or be the last standing. A rival that reaches 60% first wins.

## Saved games

Open the **?** panel and choose **Save as YAML** or **Load a save**. A save is a readable YAML file
with a `format` name and a `version` (the save-format version, currently 2; version-1 saves load as small galaxies). The game refuses files that are not
saves, saves from a newer version, older formats it cannot migrate, and damaged files, and says why.
Inside Claude the file is offered as `.yaml.txt`, because Claude only allows some download types;
the contents are the same.

When the shape of the game state changes, bump `SAVE_VERSION` in `core.js` and, if possible, add a
migration from the previous version to `MIGRATIONS`.

## Versions

The game uses semantic versioning; see [CHANGELOG.md](CHANGELOG.md). The version shows in the page header
(on phones, in the ? panel and at the foot of the orders panel), so a screenshot tells you which version
someone is running. To release: update `GAME_VERSION` in `core.js`, `version` in `package.json` and add a
CHANGELOG entry (a test checks all three agree), then tag the commit, e.g. `git tag v1.1.0`.

## Layout

- `core.js` — the pure game core (including `toSave` / `fromSave`): plain data in, plain data out, no DOM, no clock.
  `newGame(seed, difficulty, size, victory)`, `resolveTurn(state, orders, rng)`, `aiOrders(view, empire, rng)`,
  `fogView(state, empire)` and friends.
- `index.html` — the three.js renderer and the interface, an adapter over the core.
- `test/` — tests for the core.
- `e2e/` — browser tests (Playwright), with `serve.js` serving the game locally.
- `demo/` — the demo recorder.

## Test

```
npm install
npm test          # the game core: rules, saves, galaxy sizes (node:test)
npm run e2e       # the game in a real browser, desktop and phone sizes (Playwright)
```

Needs Node 18 or later. For the browser tests, install Playwright's Chromium once with
`npx playwright install chromium`. The browser tests serve the game from this folder and answer its CDN
libraries from `node_modules`, so they need no web server and no network. Both suites run on every push
through GitHub Actions (`.github/workflows/test.yml`).

## Demo

```
npm run demo
```

Plays a scripted opening and a large galaxy in a recorded browser, writing `demo-output/gabriels-reach.webm`
(and an `.mp4` and `.gif` when `ffmpeg` is installed). `docs/demo.gif` at the top of this page was made this way.
