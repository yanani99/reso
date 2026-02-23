import json
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException
from jose import JWTError, jwt
from sqlmodel import Session

from db import User, get_session
from services.analyzer import TasteProfile, build_taste_profile
from services.spotify import SpotifyClient, refresh_access_token

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
ALGORITHM = "HS256"
CACHE_DURATION = timedelta(hours=1)


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


async def ensure_valid_token(user: User, session: Session) -> str:
    if user.token_expiry <= datetime.utcnow():
        token_data = await refresh_access_token(user.refresh_token)
        user.access_token = token_data["access_token"]
        if "refresh_token" in token_data:
            user.refresh_token = token_data["refresh_token"]
        user.token_expiry = datetime.utcnow() + timedelta(
            seconds=token_data.get("expires_in", 3600)
        )
        session.add(user)
        session.commit()
    return user.access_token


@router.get("/analyze")
async def analyze(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if (
        user.profile_cache
        and user.profile_cache_at
        and (datetime.utcnow() - user.profile_cache_at) < CACHE_DURATION
    ):
        cached = json.loads(user.profile_cache)
        if cached.get("top_genres"):
            return cached

    access_token = await ensure_valid_token(user, session)
    spotify = SpotifyClient(access_token)
    raw_data = await spotify.fetch_all_data()
    profile = build_taste_profile(raw_data)

    cache_json = profile.model_dump_json()
    user.profile_cache = cache_json
    user.profile_cache_at = datetime.utcnow()
    session.add(user)
    session.commit()

    return profile.model_dump()
