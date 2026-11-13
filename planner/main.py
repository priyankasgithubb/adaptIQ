
from fastapi import FastAPI
from pydantic import BaseModel, Field, model_validator
from scheduler import build_schedule, build_recovery_schedule

app = FastAPI(title="AdaptIQ Planner")


class FreeWindow(BaseModel):
    weekday: int = Field(ge=0, le=6)
    startMin: int = Field(ge=0, le=1439)
    endMin: int = Field(ge=1, le=1440)

    @model_validator(mode="after")
    def check_times(self):
        if self.endMin <= self.startMin:
            raise ValueError("endMin must be after startMin")
        return self


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


class RecoverySubject(SubjectInput):
    remainingMin: int = Field(ge=0)


class RescheduleRequest(BaseModel):
    freeWindows: list[FreeWindow]
    subjects: list[RecoverySubject]
    blockedWindows: list[FreeWindow] = Field(default_factory=list)
    dailyLimitMin: int = Field(default=240, ge=15, le=720)
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


@app.post("/reschedule")
def reschedule(req: RescheduleRequest):
    blocks = build_recovery_schedule(
        [w.model_dump() for w in req.freeWindows],
        [s.model_dump() for s in req.subjects],
        [w.model_dump() for w in req.blockedWindows],
        req.dailyLimitMin,
        req.minBlockMin,
    )

    scheduled_by_subject = {}

    for block in blocks:
        subject_id = block["subjectId"]
        duration = block["endMin"] - block["startMin"]

        scheduled_by_subject[subject_id] = (
            scheduled_by_subject.get(subject_id, 0) + duration
        )

    remaining = []

    for subject in req.subjects:
        scheduled = scheduled_by_subject.get(subject.id, 0)

        remaining.append({
            "subjectId": subject.id,
            "subjectName": subject.name,
            "requestedMin": subject.remainingMin,
            "scheduledMin": scheduled,
            "unscheduledMin": max(0, subject.remainingMin - scheduled),
        })

    return {
        "blocks": blocks,
        "remaining": remaining,
    }
