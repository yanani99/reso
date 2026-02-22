import asyncio
import os

import httpx

SUNO_API_URL = os.getenv("SUNO_API_URL", "http://suno-api:3000")
POLL_INTERVAL_INITIAL = 5
POLL_INTERVAL_LATE = 10
LATE_THRESHOLD = 60
TIMEOUT = 180


class SunoError(Exception):
    pass


async def submit_generation(prompt: str, tags: str, title: str = "My Reso Track") -> str:
    async with httpx.AsyncClient(timeout=300.0) as client:
        resp = await client.post(
            f"{SUNO_API_URL}/api/custom_generate",
            json={
                "prompt": prompt,
                "title": title,
                "tags": tags,
                "make_instrumental": False,
                "model": "chirp-v4",
            },
        )
        if resp.status_code == 401:
            raise SunoError("Suno session expired. Please update SUNO_COOKIE in .env and restart Docker.")
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list) and len(data) > 0:
            return data[0]["id"]
        raise SunoError("Unexpected response from Suno API")


async def check_captcha_pending() -> dict | None:
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(f"{SUNO_API_URL}/api/captcha/pending")
        resp.raise_for_status()
        data = resp.json()
        if data.get("pending"):
            return {"image": data["image"], "prompt": data["prompt"]}
        return None


async def submit_captcha_solution(coordinates: list[dict]) -> bool:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{SUNO_API_URL}/api/captcha/solve",
            json={"coordinates": coordinates},
        )
        resp.raise_for_status()
        return resp.json().get("ok", False)


async def poll_for_completion(track_id: str) -> dict:
    elapsed = 0
    async with httpx.AsyncClient(timeout=15.0) as client:
        while elapsed < TIMEOUT:
            interval = POLL_INTERVAL_INITIAL if elapsed < LATE_THRESHOLD else POLL_INTERVAL_LATE
            await asyncio.sleep(interval)
            elapsed += interval

            resp = await client.get(f"{SUNO_API_URL}/api/get", params={"ids": track_id})
            if resp.status_code == 401:
                raise SunoError("Suno session expired. Please update SUNO_COOKIE in .env and restart Docker.")
            resp.raise_for_status()

            data = resp.json()
            if isinstance(data, list) and len(data) > 0:
                track = data[0]
                status = track.get("status", "")
                if status == "complete":
                    return {
                        "audio_url": track.get("audio_url", ""),
                        "image_url": track.get("image_url", ""),
                        "title": track.get("title", ""),
                    }
                if status in ("error", "failed"):
                    raise SunoError(f"Suno generation failed with status: {status}")

    raise SunoError("Suno generation timed out after 3 minutes")
