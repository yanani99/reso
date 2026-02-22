import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Response
from fastapi.responses import RedirectResponse
from jose import jwt
from sqlmodel import Session, select

from db import User, get_session
from services.spotify import SpotifyClient, exchange_code, get_auth_url

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:3000")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


def create_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/login")
def login():
    state = secrets.token_urlsafe(16)
    url = get_auth_url(state)
    return {"auth_url": url, "state": state}


@router.get("/callback")
async def callback(code: str, response: Response, session: Session = Depends(get_session)):
    token_data = await exchange_code(code)
    access_token = token_data["access_token"]
    refresh_token = token_data.get("refresh_token", "")
    expires_in = token_data.get("expires_in", 3600)
    token_expiry = datetime.utcnow() + timedelta(seconds=expires_in)

    spotify = SpotifyClient(access_token)
    user_info = await spotify.get_current_user()

    user_id = user_info["id"]
    display_name = user_info.get("display_name", user_id)

    existing = session.get(User, user_id)
    if existing:
        existing.access_token = access_token
        existing.refresh_token = refresh_token or existing.refresh_token
        existing.token_expiry = token_expiry
        session.add(existing)
    else:
        user = User(
            id=user_id,
            display_name=display_name,
            access_token=access_token,
            refresh_token=refresh_token,
            token_expiry=token_expiry,
        )
        session.add(user)
    session.commit()

    jwt_token = create_jwt(user_id)

    redirect = RedirectResponse(url=f"{FRONTEND_URL}/profile?token={jwt_token}")
    redirect.set_cookie(
        key="reso_token",
        value=jwt_token,
        httponly=True,
        samesite="lax",
        max_age=TOKEN_EXPIRE_HOURS * 3600,
    )
    return redirect
