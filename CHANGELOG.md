# Changelog

Gabriel's Landing follows [semantic versioning](https://semver.org/): MAJOR.MINOR.PATCH.
A PATCH release fixes bugs, a MINOR release adds features, and a MAJOR release changes the game in ways
that old saves or habits may not survive. The version shows in the page header (on phones, in the ? panel
and at the foot of the orders panel) and is recorded in every saved game.

The save-file format has its own number (`version` in a save); it changes only when the shape of a saved
game changes.

## 1.4.0 (2026-11-03)

- The game is now called **Gabriel's Landing** (it was Gabriel's Reach, a name already used by another game).
  New saves are marked `gabriels-landing-save` and named `gabriels-landing-….yaml`; saves made under the old name
  still load, and games in progress in your browser carry on as before.
- Winning now says "The galaxy is yours".

## 1.3.0 (2026-11-02)

- New **Status** tab in the ? panel: every empire in the game, with the systems it holds, its income in IU per
  turn, and its fighters, colony ships and scouts across all its fleets. These are true totals, fog of war
  notwithstanding, to help judge how a hard game is going. Fallen empires are listed and marked.
- New **About** tab: the game, its version, and links to play online, the source and this changelog.
- On desktops the orders panel can now grow almost to the top of the screen, so long systems need less scrolling.
- Inside a system, the ‹ Galaxy button (and Enter system on the star map) stays pinned at the top of the panel
  instead of scrolling out of sight.
- The help panel's tabs are now a vertical column down its left side, so all of them show at once instead of
  scrolling sideways on narrow screens.
- During the tutorial on desktops, the coaching strip sits over the map beside the orders panel, not on top of it.

## 1.2.0 (2026-11-01)

- Rivals no longer build a fixed number of fighters per turn (1, 2 or 3 by difficulty), however large their
  empire. Each turn they may now spend a share of the IU they hold on fighters: 50% on Easy and Normal, 80% on
  Hard; the rest goes to research. Their fleets grow with their empires, so the late game stays tense.
  Shipyard capacity applies to them as to you.
- Normal is noticeably harder than before, especially in small galaxies; Easy is still gentle.

## 1.1.0 (2026-10-31)

- Galaxies are three-dimensional: a thick disc, deepest at the core. Hyperlanes and homeworld spacing use
  true 3D distances. A faint line under each star shows its height; tilt the map to see the shape.
- Saves now record each star's height (save format 3). Older saves and games already in your browser
  load as flat galaxies.
- The Basics help is up to date. It states the general rules (2, 4 or 6 rivals; total or dominance victory),
  with the current game's size, victory, difficulty and remaining rivals in a separate "This game" box, and
  covers expansion, the turn report, 3D, and starting new games.
- The tutorial uses a new galaxy (seed 164) with the same lessons.

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
