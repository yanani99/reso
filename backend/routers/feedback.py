import os

from fastapi import APIRouter, Cookie, Depends, HTTPException
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlmodel import Session

from db import GeneratedTrack, get_session

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
ALGORITHM = "HS256"


class FeedbackRequest(BaseModel):
    track_id: str
    rating: int


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


@router.post("/feedback")
def submit_feedback(
    body: FeedbackRequest,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    track = session.get(GeneratedTrack, body.track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    if track.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your track")
    if not 1 <= body.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")

    track.rating = body.rating
    session.add(track)
    session.commit()
    return {"status": "ok", "track_id": body.track_id, "rating": body.rating}
