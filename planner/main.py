from fastapi import FastAPI
from pydantic import BaseModel, Field
from scheduler import build_schedule

app = FastAPI(title="AdaptIQ Planner")


class FreeWindow(BaseModel):
    weekday: int = Field(ge=0, le=6)     # 0 = Monday ... 6 = Sunday
    startMin: int = Field(ge=0, le=1439)
    endMin: int = Field(ge=1, le=1440)


class SubjectInput(BaseModel):
    id: str
    name: str
    score: float = Field(ge=0)


class PlanRequest(BaseModel):
    freeWindows: list[FreeWindow]
    subjects: list[SubjectInput]
    dailyLimitMin: int = Field(default=240, ge=15, le=720)
    subjectWeekCapMin: int = Field(default=240, ge=15, le=2000)
    minBlockMin: int = Field(default=45, ge=15, le=180)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/plan")
def plan(req: PlanRequest):
    blocks = build_schedule(
        [w.model_dump() for w in req.freeWindows],
        [s.model_dump() for s in req.subjects],
        req.dailyLimitMin,
        req.subjectWeekCapMin,
        req.minBlockMin,
    )
    return {"blocks": blocks}