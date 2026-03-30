from pydantic import BaseModel, field_validator
from typing import Optional

UZBEKISTAN_REGIONS = [
    "Toshkent shahri",
    "Toshkent viloyati",
    "Samarqand",
    "Buxoro",
    "Farg'ona",
    "Andijon",
    "Namangan",
    "Qashqadaryo",
    "Surxondaryo",
    "Xorazm",
    "Navoiy",
    "Jizzax",
    "Sirdaryo",
    "Qoraqalpog'iston",
]


class ShopCreate(BaseModel):
    name: str
    region: str = "Toshkent shahri"
    city: str
    address: str
    phone: str
    slot_duration: int = 30
    description: Optional[str] = None

    @field_validator("slot_duration")
    @classmethod
    def validate_slot_duration(cls, v: int) -> int:
        if v not in (15, 20, 30, 45, 60):
            raise ValueError("slot_duration must be one of 15, 20, 30, 45, 60")
        return v

    @field_validator("region")
    @classmethod
    def validate_region(cls, v: str) -> str:
        if v not in UZBEKISTAN_REGIONS:
            raise ValueError(f"region must be one of {UZBEKISTAN_REGIONS}")
        return v


class ShopUpdate(BaseModel):
    name: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    slot_duration: Optional[int] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None

    @field_validator("slot_duration")
    @classmethod
    def validate_slot_duration(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v not in (15, 20, 30, 45, 60):
            raise ValueError("slot_duration must be one of 15, 20, 30, 45, 60")
        return v

    @field_validator("region")
    @classmethod
    def validate_region(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in UZBEKISTAN_REGIONS:
            raise ValueError(f"region must be one of {UZBEKISTAN_REGIONS}")
        return v


class ShopOut(BaseModel):
    id: int
    owner_id: int
    name: str
    region: str
    city: str
    address: str
    phone: str
    slot_duration: int
    is_approved: bool
    is_active: bool
    description: Optional[str] = None
    has_photo: bool = False

    model_config = {"from_attributes": True}
