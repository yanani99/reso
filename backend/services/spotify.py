import os
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx

SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE = "https://api.spotify.com/v1"

SCOPES = [
    "user-read-recently-played",
    "user-top-read",
    "user-library-read",
    "user-read-private",
]

CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET", "")
REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:3000/callback")


def get_auth_url(state: str) -> str:
    params = {
        "client_id": CLIENT_ID,
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "scope": " ".join(SCOPES),
        "state": state,
    }
    return f"{SPOTIFY_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            SPOTIFY_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": REDIRECT_URI,
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        return resp.json()


async def refresh_access_token(refresh_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            SPOTIFY_TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        return resp.json()


class SpotifyClient:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.headers = {"Authorization": f"Bearer {access_token}"}

    async def _get(self, endpoint: str, params: dict | None = None) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{SPOTIFY_API_BASE}{endpoint}",
                headers=self.headers,
                params=params or {},
                timeout=15.0,
            )
            if resp.status_code == 429:
                import asyncio
                retry_after = int(resp.headers.get("Retry-After", "2"))
                await asyncio.sleep(retry_after)
                return await self._get(endpoint, params)
            resp.raise_for_status()
            return resp.json()

    async def get_current_user(self) -> dict:
        return await self._get("/me")

    async def get_top_tracks(self, time_range: str = "medium_term", limit: int = 50) -> list[dict]:
        data = await self._get("/me/top/tracks", {"time_range": time_range, "limit": limit})
        return data.get("items", [])

    async def get_top_artists(self, time_range: str = "medium_term", limit: int = 50) -> list[dict]:
        data = await self._get("/me/top/artists", {"time_range": time_range, "limit": limit})
        return data.get("items", [])

    async def get_recently_played(self, limit: int = 50) -> list[dict]:
        try:
            data = await self._get("/me/player/recently-played", {"limit": limit})
            return [item["track"] for item in data.get("items", [])]
        except httpx.HTTPStatusError:
            return []

    async def get_saved_tracks(self, limit: int = 50) -> list[dict]:
        try:
            data = await self._get("/me/tracks", {"limit": limit})
            return [item["track"] for item in data.get("items", [])]
        except httpx.HTTPStatusError:
            return []

    async def get_artist_details(self, artist_ids: list[str]) -> list[dict]:
        results = []
        for i in range(0, len(artist_ids), 50):
            batch = artist_ids[i : i + 50]
            try:
                data = await self._get("/artists", {"ids": ",".join(batch)})
                results.extend(a for a in data.get("artists", []) if a)
            except httpx.HTTPStatusError:
                continue
        return results

    def extract_track_meta(self, track: dict) -> dict:
        artists = [a["name"] for a in track.get("artists", [])]
        artist_ids = [a["id"] for a in track.get("artists", [])]
        album = track.get("album", {})
        return {
            "name": track.get("name"),
            "artists": artists,
            "artist_ids": artist_ids,
            "album": album.get("name"),
            "release_date": album.get("release_date", ""),
            "popularity": track.get("popularity", 0),
            "duration_ms": track.get("duration_ms", 0),
            "explicit": track.get("explicit", False),
        }

    async def fetch_all_data(self) -> dict:
        top_short = await self.get_top_tracks("short_term")
        top_medium = await self.get_top_tracks("medium_term")
        top_long = await self.get_top_tracks("long_term")
        top_artists_short = await self.get_top_artists("short_term")
        top_artists_medium = await self.get_top_artists("medium_term")
        recently_played = await self.get_recently_played()
        saved_tracks = await self.get_saved_tracks()

        all_artist_ids: set[str] = set()
        for track_list in [top_short, top_medium, top_long, recently_played, saved_tracks]:
            for track in track_list:
                for artist in track.get("artists", []):
                    all_artist_ids.add(artist["id"])
        for artist in top_artists_short + top_artists_medium:
            all_artist_ids.add(artist["id"])

        artist_details = await self.get_artist_details(list(all_artist_ids))
        artist_map = {a["id"]: a for a in artist_details if a}

        def enrich(tracks: list[dict]) -> list[dict]:
            enriched = []
            for t in tracks:
                meta = self.extract_track_meta(t)
                genres = []
                for aid in meta["artist_ids"]:
                    if aid in artist_map:
                        genres.extend(artist_map[aid].get("genres", []))
                meta["genres"] = genres
                enriched.append(meta)
            return enriched

        return {
            "top_short": enrich(top_short),
            "top_medium": enrich(top_medium),
            "top_long": enrich(top_long),
            "recently_played": enrich(recently_played),
            "saved_tracks": enrich(saved_tracks),
            "top_artists_short": [
                {"name": a["name"], "genres": a.get("genres", []), "popularity": a.get("popularity", 0)}
                for a in top_artists_short
            ],
            "top_artists_medium": [
                {"name": a["name"], "genres": a.get("genres", []), "popularity": a.get("popularity", 0)}
                for a in top_artists_medium
            ],
        }
