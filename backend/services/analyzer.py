import re
from collections import Counter
from statistics import median

from pydantic import BaseModel


class TasteProfile(BaseModel):
    top_genres: list[str]
    genre_clusters: list[str]
    era_range: str
    era_center: int
    sample_top_tracks: list[str]
    sample_top_artists: list[str]
    popularity_avg: float
    explicit_ratio: float
    track_count: int
    confidence: str


GENRE_CLUSTER_MAP = {
    "indie": "indie",
    "alt": "alternative",
    "rock": "rock",
    "pop": "pop",
    "hip hop": "hip hop",
    "rap": "hip hop",
    "trap": "hip hop",
    "r&b": "r&b",
    "soul": "r&b/soul",
    "electronic": "electronic",
    "edm": "electronic",
    "house": "electronic",
    "techno": "electronic",
    "ambient": "electronic",
    "metal": "metal",
    "punk": "punk",
    "jazz": "jazz",
    "classical": "classical",
    "country": "country",
    "folk": "folk",
    "latin": "latin",
    "reggaeton": "latin",
    "k-pop": "k-pop",
    "j-pop": "j-pop",
}


def _extract_year(release_date: str) -> int | None:
    if not release_date:
        return None
    match = re.match(r"(\d{4})", release_date)
    return int(match.group(1)) if match else None


def _cluster_genre(genre: str) -> str | None:
    genre_lower = genre.lower()
    for key, cluster in GENRE_CLUSTER_MAP.items():
        if key in genre_lower:
            return cluster
    return None


WEIGHTS = {
    "saved_tracks": 3.0,
    "top_short": 2.5,
    "recently_played": 2.0,
    "top_medium": 1.5,
    "top_long": 1.0,
}


def build_taste_profile(data: dict) -> TasteProfile:
    genre_counter: Counter = Counter()
    years: list[int] = []
    popularity_values: list[float] = []
    explicit_count = 0
    total_tracks = 0

    for source, weight in WEIGHTS.items():
        tracks = data.get(source, [])
        for track in tracks:
            total_tracks += 1
            for g in track.get("genres", []):
                genre_counter[g] += weight
            year = _extract_year(track.get("release_date", ""))
            if year and 1950 <= year <= 2030:
                years.append(year)
            popularity_values.append(track.get("popularity", 50))
            if track.get("explicit"):
                explicit_count += 1

    top_genres = [g for g, _ in genre_counter.most_common(8)]

    cluster_counter: Counter = Counter()
    for genre, count in genre_counter.items():
        cluster = _cluster_genre(genre)
        if cluster:
            cluster_counter[cluster] += count
    genre_clusters = [c for c, _ in cluster_counter.most_common(5)]

    if years:
        sorted_years = sorted(years)
        era_min = sorted_years[len(sorted_years) // 10] if len(sorted_years) > 10 else sorted_years[0]
        era_max = sorted_years[-1]
        era_min_decade = (era_min // 10) * 10
        era_max_decade = (era_max // 10) * 10
        era_range = f"{era_min_decade}s-{era_max_decade}s"
        era_center = int(median(years))
    else:
        era_range = "2010s-2020s"
        era_center = 2018

    short_tracks = data.get("top_short", [])
    sample_top_tracks = [
        f"{t['name']} — {', '.join(t['artists'])}" for t in short_tracks[:10]
    ]

    artist_names_short = [a["name"] for a in data.get("top_artists_short", [])]
    artist_names_medium = [a["name"] for a in data.get("top_artists_medium", [])]
    seen = set()
    sample_top_artists = []
    for name in artist_names_short + artist_names_medium:
        if name not in seen:
            seen.add(name)
            sample_top_artists.append(name)
        if len(sample_top_artists) >= 10:
            break

    popularity_avg = sum(popularity_values) / len(popularity_values) if popularity_values else 50.0
    explicit_ratio = explicit_count / total_tracks if total_tracks > 0 else 0.0

    if total_tracks >= 80:
        confidence = "high"
    elif total_tracks >= 30:
        confidence = "medium"
    else:
        confidence = "low"

    return TasteProfile(
        top_genres=top_genres,
        genre_clusters=genre_clusters,
        era_range=era_range,
        era_center=era_center,
        sample_top_tracks=sample_top_tracks,
        sample_top_artists=sample_top_artists,
        popularity_avg=round(popularity_avg, 1),
        explicit_ratio=round(explicit_ratio, 2),
        track_count=total_tracks,
        confidence=confidence,
    )
