from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class ReviewCreate(BaseModel):
    booking_id: int
    rating: int
    comment: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v):
        if v not in (1, 2, 3, 4, 5):
            raise ValueError("Rating must be between 1 and 5")
        return v


class ReviewOut(BaseModel):
    id: int
    booking_id: int
    shop_id: int
    customer_name: Optional[str]
    rating: int
    comment: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ShopReviewSummary(BaseModel):
    average_rating: float
    total_reviews: int
    reviews: list[ReviewOut]
