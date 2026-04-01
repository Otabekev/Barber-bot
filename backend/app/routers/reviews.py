from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.booking import Booking
from app.models.shop import Shop
from app.models.review import Review
from app.schemas.review import ReviewCreate, ReviewOut, ShopReviewSummary

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("/", response_model=ReviewOut, status_code=201)
async def submit_review(
    data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Customer submits a review for a completed booking."""
    # Verify booking belongs to this customer and is completed
    booking_result = await db.execute(
        select(Booking).where(
            Booking.id == data.booking_id,
            Booking.customer_id == current_user.id,
        )
    )
    booking = booking_result.scalar_one_or_none()
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "completed":
        raise HTTPException(status_code=400, detail="Can only review completed bookings")

    # Check no existing review
    existing = await db.execute(
        select(Review).where(Review.booking_id == data.booking_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You already reviewed this booking")

    review = Review(
        booking_id=data.booking_id,
        shop_id=booking.shop_id,
        customer_id=current_user.id,
        customer_name=booking.customer_name,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return review


@router.get("/shop/{shop_id}", response_model=ShopReviewSummary)
async def get_shop_reviews(shop_id: int, db: AsyncSession = Depends(get_db)):
    """Public: get all reviews for a shop with average rating."""
    result = await db.execute(
        select(Review)
        .where(Review.shop_id == shop_id)
        .order_by(Review.created_at.desc())
    )
    reviews = result.scalars().all()
    total = len(reviews)
    avg = round(sum(r.rating for r in reviews) / total, 1) if total > 0 else 0.0
    return ShopReviewSummary(average_rating=avg, total_reviews=total, reviews=reviews)


@router.get("/my-shop", response_model=ShopReviewSummary)
async def get_my_shop_reviews(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Barber: see all reviews for their own shop."""
    shop_result = await db.execute(select(Shop).where(Shop.owner_id == current_user.id))
    shop = shop_result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status_code=404, detail="Shop not found")

    result = await db.execute(
        select(Review)
        .where(Review.shop_id == shop.id)
        .order_by(Review.created_at.desc())
    )
    reviews = result.scalars().all()
    total = len(reviews)
    avg = round(sum(r.rating for r in reviews) / total, 1) if total > 0 else 0.0
    return ShopReviewSummary(average_rating=avg, total_reviews=total, reviews=reviews)
