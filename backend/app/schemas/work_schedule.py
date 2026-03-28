from pydantic import BaseModel, field_validator
from typing import List
import re


TIME_RE = re.compile(r"^\d{2}:\d{2}$")


class ScheduleItem(BaseModel):
    day_of_week: int  # 0=Monday … 6=Sunday
    open_time: str    # "HH:MM"
    close_time: str   # "HH:MM"
    is_working: bool = True

    @field_validator("day_of_week")
    @classmethod
    def validate_day(cls, v: int) -> int:
        if v not in range(7):
            raise ValueError("day_of_week must be 0–6")
        return v

    @field_validator("open_time", "close_time")
    @classmethod
    def validate_time(cls, v: str) -> str:
        if not TIME_RE.match(v):
            raise ValueError("time must be HH:MM")
        return v


class ScheduleUpdate(BaseModel):
    schedules: List[ScheduleItem]


class ScheduleOut(BaseModel):
    id: int
    shop_id: int
    day_of_week: int
    open_time: str
    close_time: str
    is_working: bool

    model_config = {"from_attributes": True}
