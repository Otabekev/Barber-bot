from pydantic import BaseModel
from datetime import date
from typing import List


class BlockSlotCreate(BaseModel):
    block_date: date
    time_slots: List[str]


class UnblockSlotRequest(BaseModel):
    block_date: date
    time_slots: List[str]


class BlockedSlotOut(BaseModel):
    id: int
    shop_id: int
    block_date: date
    time_slot: str

    model_config = {"from_attributes": True}
