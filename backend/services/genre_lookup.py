import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

import musicbrainzngs

logging.getLogger("musicbrainzngs").setLevel(logging.WARNING)

musicbrainzngs.set_useragent("Reso", "0.1.0", "https://github.com/yourusername/reso")

_executor = ThreadPoolExecutor(max_workers=2)

TAG_REMAP = {
    "hip-hop": "hip hop",
    "r&b": "r&b",
    "rhythm and blues": "r&b",
    "electronic music": "electronic",
    "electropop": "electropop",
    "synthpop": "synth-pop",
    "post-punk": "post-punk",
}


def _clean_tag(tag: str) -> str:
    t = tag.lower().strip()
    return TAG_REMAP.get(t, t)


def _mb_call_with_retry(fn, *args, retries=2, **kwargs):
    for attempt in range(retries + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            if attempt < retries and ("SSL" in str(e) or "urlopen error" in str(e) or "EOF" in str(e)):
                time.sleep(2)
                continue
            raise


@lru_cache(maxsize=256)
def _search_artist_genres(artist_name: str) -> list[str]:
    try:
        result = _mb_call_with_retry(musicbrainzngs.search_artists, artist=artist_name, limit=1)
        artists = result.get("artist-list", [])
        if not artists:
            return []

        artist_id = artists[0]["id"]
        detail = _mb_call_with_retry(musicbrainzngs.get_artist_by_id, artist_id, includes=["tags"])
        tags = detail.get("artist", {}).get("tag-list", [])
        ranked = sorted(tags, key=lambda t: int(t.get("count", 0)), reverse=True)
        return [_clean_tag(t["name"]) for t in ranked[:6] if int(t.get("count", 0)) >= 1]
    except Exception as e:
        print(f"[musicbrainz] error looking up '{artist_name}': {e}", flush=True)
        return []


async def lookup_genres_batch(artist_names: list[str]) -> dict[str, list[str]]:
    """Look up genres for a batch of artists via MusicBrainz. Returns {name: [genres]}."""
    loop = asyncio.get_event_loop()
    results: dict[str, list[str]] = {}

    for name in artist_names:
        genres = await loop.run_in_executor(_executor, _search_artist_genres, name)
        results[name] = genres
        await asyncio.sleep(1.1)

    return results
