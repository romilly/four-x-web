"""Checks that the Python wrapper drives the simulator. Run from the repository: python -m pytest sim"""
import pytest

from balance import run_balance, summarise

TWO = {'Easy': {'base': 'easy'}, 'Hard 100%': {'base': 'hard', 'income': 1.0}}


def test_one_row_per_game_in_variant_order():
    df = run_balance(TWO, galaxies=2, turns=30)
    assert len(df) == 4
    assert list(df['variant'].cat.categories) == ['Easy', 'Hard 100%']
    assert set(df['result']) <= {'win', 'loss', 'unfinished'}


def test_the_same_seeds_give_the_same_games():
    assert run_balance(TWO, seeds=[7, 8], turns=30).equals(run_balance(TWO, seeds=[7, 8], turns=30))


def test_summary_counts_every_game():
    s = summarise(run_balance(TWO, galaxies=3, turns=30))
    assert (s[['win', 'loss', 'unfinished']].sum(axis=1) == 3).all()


def test_mistakes_in_a_variant_are_refused():
    with pytest.raises(ValueError, match='unknown setting "incom"'):
        run_balance({'X': {'base': 'hard', 'incom': 1}}, galaxies=1)
