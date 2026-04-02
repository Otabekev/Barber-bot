from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date


VALID_STATUSES = {"pending", "confirmed", "cancelled", "completed", "no_show"}
VALID_SERVICE_TYPES = {"haircut", "beard", "combo"}


class BookingCreate(BaseModel):
    shop_id: int
    booking_date: date
    time_slot: str
    customer_name: str
    customer_phone: str
    service_type: str = "haircut"

    @field_validator("service_type")
    @classmethod
    def validate_service_type(cls, v: str) -> str:
        if v not in VALID_SERVICE_TYPES:
            raise ValueError(f"service_type must be one of {VALID_SERVICE_TYPES}")
        return v


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
    service_type: str = "haircut"

    model_config = {"from_attributes": True}
