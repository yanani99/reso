import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import create_db_and_tables
from routers import auth, captcha, feedback, generate, profile

app = FastAPI(title="Reso", version="0.1.0")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3002",
        "http://localhost:3000",
        "http://localhost:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(generate.router, prefix="/api", tags=["generate"])
app.include_router(feedback.router, prefix="/api", tags=["feedback"])
app.include_router(captcha.router, prefix="/api", tags=["captcha"])


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.get("/health")
def health():
    return {"status": "ok"}
