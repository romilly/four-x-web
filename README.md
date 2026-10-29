# Gabriel's Reach

A small turn-based space 4X in the browser, rendered with three.js.
Explore a fogged star cluster, split and merge fleets, settle colonies,
research, and out-fight two scripted rivals.

## Play

Open `index.html` in a browser. It loads three.js from a CDN, so it needs a connection.

- Touch: drag to pan, pinch to zoom, drag with two fingers to rotate.
- Mouse: drag to pan, scroll to zoom, right-drag or Shift-drag to rotate.

## Layout

- `core.js` — the pure game core: plain data in, plain data out, no DOM, no clock.
  `newGame(seed, difficulty)`, `resolveTurn(state, orders, rng)`, `aiOrders(view, empire, rng)`,
  `fogView(state, empire)` and friends.
- `index.html` — the three.js renderer and the interface, an adapter over the core.
- `test/` — tests for the core.

## Test

```
node --test
```

Needs Node 18 or later. No dependencies.
