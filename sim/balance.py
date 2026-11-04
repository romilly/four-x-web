"""Balance simulations for Gabriel's Landing, from Python or a Jupyter notebook.

Runs sim/balance.js (which plays the real game core, core.js) once per variant, in parallel, and returns one
row per game as a pandas DataFrame. Needs Node 18 or later on the PATH, and pandas. Import it, or paste the
whole file into a notebook cell.

    df = run_balance({'Hard 100%': {'base': 'hard', 'income': 1.0},
                      'Hard 125%': {'base': 'hard'}}, galaxies=48)
    summarise(df)

A variant is a base difficulty ('easy', 'normal' or 'hard') plus any settings to override: fog, attackTurn,
shipShare, income (see DIFF in core.js). The player's side is played by a scripted stand-in, the rivals' own
AI with fog of war and Normal habits, so compare variants with each other rather than reading the numbers as
a person's chances.
"""
import json
import math
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pandas as pd


def find_repo(start='.'):
    """The four-x-web folder: the given folder or the nearest one above it that holds core.js."""
    here = Path(start).expanduser().resolve()
    for folder in [here, *here.parents]:
        if (folder / 'core.js').exists() and (folder / 'sim' / 'balance.js').exists():
            return folder
    raise FileNotFoundError(f"No four-x-web checkout at or above {here}; pass repo='path/to/four-x-web'.")


def _run_variant(repo, name, settings, size, galaxies, turns, seeds, victory):
    spec = {'size': size, 'galaxies': galaxies, 'turns': turns, 'victory': victory, 'variants': {name: settings}}
    if seeds is not None:
        spec['seeds'] = list(seeds)
    done = subprocess.run(['node', str(repo / 'sim' / 'balance.js')], input=json.dumps(spec),
                          capture_output=True, text=True, cwd=repo)
    if done.returncode != 0:
        raise ValueError(done.stderr.strip() or f'sim/balance.js failed for variant {name!r}')
    return [json.loads(line) for line in done.stdout.splitlines() if line]


def run_balance(variants, size='small', galaxies=24, turns=200, seeds=None, victory='total', repo=None):
    """Play `galaxies` games (one galaxy each) under each variant; one row per game.

    galaxies  runs per variant: more runs, smaller standard error (four times as many halves it)

    variants  {name: {'base': 'hard', 'income': 1.0, ...}}, in the order you want them reported
    size      'small', 'medium' or 'large'
    seeds     galaxy seeds to use instead of 1000, 1037, 1074, ... (the same seeds give the same games)
    victory   'total' or 'dominance'
    repo      the four-x-web folder; found from the current folder if not given

    Columns: variant, seed, size, result ('win', 'loss' or 'unfinished'), end_turn, biggest_rival_fleet, and for
    turns 30, 60 and 120 the stand-in's share of habitable planets, its income and the best rival's income
    (empty if the game had ended or the stand-in had fallen by then).
    """
    repo = Path(repo).expanduser().resolve() if repo else find_repo()
    with ThreadPoolExecutor(max_workers=len(variants) or 1) as pool:
        jobs = [pool.submit(_run_variant, repo, name, settings, size, galaxies, turns, seeds, victory)
                for name, settings in variants.items()]
        rows = [row for job in jobs for row in job.result()]
    df = pd.DataFrame(rows)
    df['variant'] = pd.Categorical(df['variant'], categories=list(variants), ordered=True)
    return df


def summarise(df):
    """Wins, losses and unfinished games per variant, with the win rate and its standard error.

    Differences in win rate smaller than about two standard errors are likely to be chance.
    """
    out = (df.groupby('variant', observed=True)['result'].value_counts().unstack(fill_value=0)
             .reindex(columns=['win', 'loss', 'unfinished'], fill_value=0))
    games = out.sum(axis=1)
    out['win_rate'] = (out['win'] / games).round(3)
    out['std_error'] = [round(math.sqrt(p * (1 - p) / n), 3) for p, n in zip(out['win_rate'], games)]
    out['median_end_turn'] = df.groupby('variant', observed=True)['end_turn'].median()
    out['median_best_rival_income_60'] = df.groupby('variant', observed=True)['best_rival_income_60'].median()
    return out
