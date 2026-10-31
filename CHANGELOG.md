# Changelog

Gabriel's Reach follows [semantic versioning](https://semver.org/): MAJOR.MINOR.PATCH.
A PATCH release fixes bugs, a MINOR release adds features, and a MAJOR release changes the game in ways
that old saves or habits may not survive. The version shows in the page header (on phones, in the ? panel
and at the foot of the orders panel) and is recorded in every saved game.

The save-file format has its own number (`version` in a save); it changes only when the shape of a saved
game changes.

## 1.0.1 (2026-10-31)

- Ships built in the same system in one turn now give a single dispatch, such as
  "2 fighters and 1 scout created at Yed and joined Fleet 1", instead of one line per ship.

## 1.0.0 (2026-10-30)

The first numbered release, covering everything built so far:

- Galaxies of 28, 48 or 72 stars with 3, 5 or 7 empires; planets shaped by their star's colour.
- Victory by elimination or by dominance (60% of habitable planets).
- Fleets that split and merge; colonising by explicit order; sieges aimed at a chosen planet.
- Shipyard capacity: 1 ship a turn per system, plus 1 for every 4 people there.
- Fog of war for every empire; Easy, Normal and Hard rivals.
- YAML save and load (save format 2).
- Tabbed help, hints in context, and a 16-step tutorial.
