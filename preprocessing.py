import re

import polars as pl

from config import settings

_LIST_ITEM = r"""'[^']*'|"[^"]*\""""


def _parse_list(col: str) -> pl.Expr:
    return pl.col(col).str.extract_all(_LIST_ITEM).list.eval(pl.element().str.strip_chars("'\""))


def _macro_genre(genres: pl.Expr) -> pl.Expr:
    names = list(settings.macro_genres)
    hits = [
        genres.list.eval(
            pl.element().str.contains("|".join(map(re.escape, keywords))).cast(pl.Int32)
        ).list.sum().fill_null(0)
        for keywords in settings.macro_genres.values()
    ]
    return (
        pl.when(pl.max_horizontal(hits) > 0)
        .then(pl.concat_list(hits).list.arg_max().replace_strict(dict(enumerate(names)), return_dtype=pl.String))
        .otherwise(None)
    )


def load_tracks() -> pl.DataFrame:
    s = settings
    artist_genres = pl.scan_csv(s.path(s.artist_genres_file)).select(
        pl.col("artists").alias("artist"), _parse_list("genres").alias("genres")
    )
    return (
        pl.scan_csv(s.path(s.tracks_file))
        .filter(
            (pl.col("speechiness") <= s.max_speechiness)
            & (pl.col("tempo") >= s.min_tempo)
            & (pl.col("duration_ms") <= s.max_duration_ms)
        )
        .with_columns(_parse_list("artists").list.first().alias("artist"))
        .join(artist_genres, on="artist", how="left")
        .with_columns(_macro_genre(pl.col("genres")).alias("genre"))
        .filter(pl.col("genre").is_not_null())
        .select("id", "name", "artist", "year", "genre", *s.features)
        .collect()
    )


def normalize(df: pl.DataFrame) -> pl.DataFrame:
    lo_q, hi_q = settings.clip_quantiles
    exprs = []
    for f in settings.features:
        if f in settings.scaled_features:
            lo, hi = df[f].quantile(lo_q), df[f].quantile(hi_q)
            exprs.append(((pl.col(f).clip(lo, hi) - lo) / (hi - lo)).alias(f))
        else:
            exprs.append(pl.col(f).clip(0.0, 1.0))
    return df.with_columns(pl.struct(exprs).alias("norm"))


def stratified_sample(df: pl.DataFrame) -> pl.DataFrame:
    rank = pl.int_range(pl.len()).shuffle(seed=settings.random_state).over("genre")
    return df.filter(rank < settings.sample_per_genre)


def build_payload() -> dict:
    tracks = stratified_sample(normalize(load_tracks()))
    return {
        "features": settings.features,
        "genres": [g for g in settings.macro_genres if g in set(tracks["genre"])],
        "defaults": {
            "focus": settings.default_focus_genres,
            "radviz_anchors": settings.radviz_anchors,
        },
        "records": tracks.to_dicts(),
    }
