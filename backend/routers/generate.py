import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlmodel import Session

from db import GeneratedTrack, User, get_session
from services.analyzer import TasteProfile, build_taste_profile
from services.prompt_builder import generate_prompts
from services.spotify import SpotifyClient, refresh_access_token
from services.suno import SunoError, check_captcha_pending, poll_for_completion, submit_generation

logger = logging.getLogger("reso.generate")

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
ALGORITHM = "HS256"


class GenerateRequest(BaseModel):
    platform: str = "suno"
    custom_prompt_override: str | None = None
    novelty_level: float = 0.2


def get_current_user_id(reso_token: str = Cookie(None)) -> str:
    if not reso_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(reso_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/generate")
async def generate(
    body: GenerateRequest,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    async def event_stream():
        try:
            yield sse_event("status", {"stage": "building_prompt", "message": "Crafting your sound profile..."})

            if user.profile_cache:
                profile = TasteProfile(**json.loads(user.profile_cache))
            else:
                if user.token_expiry <= datetime.now(timezone.utc):
                    from services.spotify import refresh_access_token as refresh_fn
                    token_data = await refresh_fn(user.refresh_token)
                    user.access_token = token_data["access_token"]
                    if "refresh_token" in token_data:
                        user.refresh_token = token_data["refresh_token"]
                    session.add(user)
                    session.commit()

                spotify = SpotifyClient(user.access_token)
                raw_data = await spotify.fetch_all_data()
                profile = build_taste_profile(raw_data)

            prompts = await generate_prompts(profile, body.novelty_level)

            suno_prompt = body.custom_prompt_override or prompts["suno_prompt"]

            yield sse_event("prompt_ready", {
                "suno_prompt": prompts["suno_prompt"],
                "lyria_prompt": prompts["lyria_prompt"],
                "song_concept": prompts["song_concept"],
                "mood": prompts.get("mood", ""),
                "tempo_feel": prompts.get("tempo_feel", ""),
                "energy_estimate": prompts.get("energy_estimate", 0.5),
                "valence_estimate": prompts.get("valence_estimate", 0.5),
            })

            yield sse_event("status", {"stage": "generating", "message": "Generating your track..."})

            tags = ", ".join(profile.top_genres[:5])
            gen_task = asyncio.create_task(submit_generation(suno_prompt, tags))

            print("[generate] gen_task created, entering CAPTCHA poll loop", flush=True)

            captcha_sent = False
            poll_count = 0
            while not gen_task.done():
                poll_count += 1
                print(f"[generate] poll #{poll_count}", flush=True)
                try:
                    captcha = await check_captcha_pending()
                    if captcha and not captcha_sent:
                        print(f"[generate] CAPTCHA FOUND on poll #{poll_count} ({len(captcha['image'])} bytes), yielding SSE event", flush=True)
                        yield sse_event("captcha_required", {
                            "image": captcha["image"],
                            "prompt": captcha["prompt"],
                        })
                        print(f"[generate] CAPTCHA SSE event yielded", flush=True)
                        captcha_sent = True
                    elif captcha and captcha_sent:
                        print(f"[generate] poll #{poll_count}: still pending (already sent)", flush=True)
                    else:
                        if captcha_sent:
                            print(f"[generate] poll #{poll_count}: CAPTCHA cleared", flush=True)
                        captcha_sent = False
                except Exception as exc:
                    print(f"[generate] poll #{poll_count} ERROR: {exc}", flush=True)
                if poll_count % 5 == 0:
                    yield ": keepalive\n\n"
                await asyncio.sleep(2)

            print(f"[generate] gen_task finished, done={gen_task.done()}", flush=True)
            suno_id = await gen_task
            print(f"[generate] suno_id={suno_id}, starting poll_for_completion", flush=True)

            result = await poll_for_completion(suno_id)
            print(f"[generate] poll_for_completion returned: {result}", flush=True)

            track_id = str(uuid.uuid4())
            generated = GeneratedTrack(
                id=track_id,
                user_id=user.id,
                suno_track_id=suno_id,
                audio_url=result["audio_url"],
                image_url=result.get("image_url"),
                suno_prompt=prompts["suno_prompt"],
                lyria_prompt=prompts["lyria_prompt"],
                song_concept=prompts["song_concept"],
                platform=body.platform,
            )
            session.add(generated)
            session.commit()

            yield sse_event("complete", {
                "audio_url": result["audio_url"],
                "image_url": result.get("image_url", ""),
                "track_id": track_id,
                "title": result.get("title", "Your Reso Track"),
                "suno_url": f"https://suno.com/song/{suno_id}",
            })

        except SunoError as e:
            print(f"[generate] SunoError: {e}", flush=True)
            yield sse_event("error", {"message": str(e)})
        except Exception as e:
            import traceback
            print(f"[generate] EXCEPTION: {e}\n{traceback.format_exc()}", flush=True)
            yield sse_event("error", {"message": f"Generation failed: {str(e)}"})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
