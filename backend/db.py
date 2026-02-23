import os
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel, Session, create_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./reso.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)


class User(SQLModel, table=True):
    id: str = Field(primary_key=True)
    display_name: str
    access_token: str
    refresh_token: str
    token_expiry: datetime
    profile_cache: Optional[str] = None
    profile_cache_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class GeneratedTrack(SQLModel, table=True):
    id: str = Field(primary_key=True)
    user_id: str = Field(foreign_key="user.id")
    suno_track_id: str
    audio_url: str
    image_url: Optional[str] = None
    suno_prompt: str
    lyria_prompt: str
    song_concept: str
    platform: str
    rating: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
