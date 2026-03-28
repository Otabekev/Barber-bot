from pydantic import BaseModel
from typing import Optional
from datetime import date


VALID_STATUSES = {"pending", "confirmed", "cancelled", "completed"}


class BookingCreate(BaseModel):
    shop_id: int
    booking_date: date
    time_slot: str
    customer_name: str
    customer_phone: str


class BookingStatusUpdate(BaseModel):
    status: str

    def validate_status(self) -> None:
        if self.status not in VALID_STATUSES:
            raise ValueError(f"status must be one of {VALID_STATUSES}")


class BookingOut(BaseModel):
    id: int
    customer_id: Optional[int] = None
    shop_id: int
    booking_date: date
    time_slot: str
    status: str
    customer_name: str
    customer_phone: str

    model_config = {"from_attributes": True}
