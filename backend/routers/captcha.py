from fastapi import APIRouter
from pydantic import BaseModel

from services.suno import submit_captcha_solution

router = APIRouter()


class Coordinate(BaseModel):
    x: float
    y: float


class SolveRequest(BaseModel):
    coordinates: list[Coordinate]


@router.post("/captcha/solve")
async def solve_captcha(body: SolveRequest):
    coords = [{"x": c.x, "y": c.y} for c in body.coordinates]
    ok = await submit_captcha_solution(coords)
    return {"ok": ok}
