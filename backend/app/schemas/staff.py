from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class StaffUserInfo(BaseModel):
    id: int
    telegram_id: int
    full_name: str
    language: str

    model_config = {"from_attributes": True}


class StaffOut(BaseModel):
    id: int
    shop_id: int
    user_id: int
    display_name: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    has_photo: bool = False
    is_active: bool = True
    is_approved: bool = False
    is_rejected: bool = False
    created_at: datetime
    user: Optional[StaffUserInfo] = None
    is_owner: bool = False          # set by router, not from DB
    avg_rating: Optional[float] = None
    review_count: int = 0

    model_config = {"from_attributes": True}


class StaffPublic(BaseModel):
    """Lightweight staff info returned to customers/bot."""
    id: int
    display_name: Optional[str] = None
    has_photo: bool = False
    avg_rating: Optional[float] = None
    review_count: int = 0

    model_config = {"from_attributes": True}


class StaffUpdate(BaseModel):
    display_name: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None


class InviteOut(BaseModel):
    token: str
    deep_link: str
    expires_at: datetime
    shop_name: str


class InviteInfo(BaseModel):
    shop_name: str
    shop_city: str
    expires_at: datetime
    is_expired: bool
    is_used: bool
