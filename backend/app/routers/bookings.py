import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import date

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.booking import Booking
from app.schemas.booking import BookingCreate, BookingStatusUpdate, BookingOut, VALID_STATUSES
from app.services.notifications import (
    notify_barber_new_booking,
    notify_barber_customer_cancelled,
    notify_customer_status_change,
)
from app.services.slot_utils import get_service_duration, times_overlap

router = APIRouter(prefix="/bookings", tags=["bookings"])


async def _get_owner_shop(user: User, db: AsyncSession) -> Shop:
    result = await db.execute(select(Shop).where(Shop.owner_id == user.id))
    shop = result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.get("/my-shop", response_model=List[BookingOut])
async def get_shop_bookings(
    status: Optional[str] = Query(None, description="Filter by status"),
    from_date: Optional[date] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop = await _get_owner_shop(current_user, db)

    query = (
        select(Booking)
        .where(Booking.shop_id == shop.id)
        .order_by(Booking.booking_date, Booking.time_slot)
    )
    if status:
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Use one of {VALID_STATUSES}")
        query = query.where(Booking.status == status)
    if from_date:
        query = query.where(Booking.booking_date >= from_date)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=BookingOut, status_code=201)
async def create_booking(
    data: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Book a slot (called by customers via the customer mini app)."""
    # Fetch shop for duration calculation
    shop_result = await db.execute(select(Shop).where(Shop.id == data.shop_id))
    shop = shop_result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status_code=404, detail="Shop not found")

    req_duration = get_service_duration(shop, data.service_type)

    # Fetch all active bookings for that day
    active_result = await db.execute(
        select(Booking).where(
            Booking.shop_id == data.shop_id,
            Booking.booking_date == data.booking_date,
            Booking.status.in_(["pending", "confirmed"]),
        )
    )
    active_bookings = active_result.scalars().all()

    # Check time-range overlap with each existing booking
    for b in active_bookings:
        b_duration = get_service_duration(shop, b.service_type)
        if times_overlap(data.time_slot, req_duration, b.time_slot, b_duration):
            raise HTTPException(status_code=409, detail="This time slot is not available")

    booking = Booking(customer_id=current_user.id, **data.model_dump())
    db.add(booking)
    await db.commit()
    await db.refresh(booking)

    # Notify the barber — fire and forget (don't fail the request if notification fails)
    shop_result = await db.execute(select(Shop).where(Shop.id == data.shop_id))
    shop = shop_result.scalar_one_or_none()
    if shop:
        owner_result = await db.execute(select(User).where(User.id == shop.owner_id))
        owner = owner_result.scalar_one_or_none()
        if owner:
            asyncio.create_task(notify_barber_new_booking(
                barber_telegram_id=owner.telegram_id,
                customer_name=data.customer_name,
                customer_phone=data.customer_phone,
                booking_date=str(data.booking_date),
                time_slot=data.time_slot,
                barber_language=owner.language,
            ))

    return booking


@router.patch("/{booking_id}/status", response_model=BookingOut)
async def update_booking_status(
    booking_id: int,
    body: BookingStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Owner updates booking status (confirm / complete / cancel)."""
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Use one of {VALID_STATUSES}")

    shop = await _get_owner_shop(current_user, db)

    result = await db.execute(
        select(Booking).where(Booking.id == booking_id, Booking.shop_id == shop.id)
    )
    booking = result.scalar_one_or_none()
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking.status = body.status
    await db.commit()
    await db.refresh(booking)

    # Notify the customer if they exist
    if booking.customer_id and body.status in ("confirmed", "cancelled", "completed"):
        customer_result = await db.execute(select(User).where(User.id == booking.customer_id))
        customer = customer_result.scalar_one_or_none()
        if customer:
            asyncio.create_task(notify_customer_status_change(
                customer_telegram_id=customer.telegram_id,
                new_status=body.status,
                shop_name=shop.name,
                shop_address=shop.address,
                booking_date=str(booking.booking_date),
                time_slot=booking.time_slot,
                customer_language=customer.language,
            ))

    return booking


@router.get("/my", response_model=List[BookingOut])
async def get_my_bookings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get bookings made by the current user as a customer."""
    result = await db.execute(
        select(Booking)
        .where(Booking.customer_id == current_user.id)
        .order_by(Booking.booking_date, Booking.time_slot)
    )
    return result.scalars().all()


@router.patch("/{booking_id}/cancel", response_model=BookingOut)
async def cancel_my_booking(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Customer cancels their own booking."""
    result = await db.execute(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.customer_id == current_user.id,
        )
    )
    booking = result.scalar_one_or_none()
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status in ("cancelled", "completed"):
        raise HTTPException(status_code=400, detail="Cannot cancel this booking")

    booking.status = "cancelled"
    await db.commit()
    await db.refresh(booking)

    # Notify the barber that their customer cancelled
    shop_result = await db.execute(select(Shop).where(Shop.id == booking.shop_id))
    shop = shop_result.scalar_one_or_none()
    if shop:
        owner_result = await db.execute(select(User).where(User.id == shop.owner_id))
        owner = owner_result.scalar_one_or_none()
        if owner:
            asyncio.create_task(notify_barber_customer_cancelled(
                barber_telegram_id=owner.telegram_id,
                customer_name=booking.customer_name,
                customer_phone=booking.customer_phone,
                booking_date=str(booking.booking_date),
                time_slot=booking.time_slot,
                barber_language=owner.language,
            ))

    return booking
