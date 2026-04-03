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
from app.models.staff import Staff
from app.models.booking import Booking
from app.schemas.booking import BookingCreate, BookingStatusUpdate, BookingOut, VALID_STATUSES
from pydantic import BaseModel


class MessageRequest(BaseModel):
    message: str


from app.services.notifications import (
    notify_barber_new_booking,
    notify_barber_customer_cancelled,
    notify_customer_status_change,
    notify_barber_message,
    send_review_request,
)
from app.config import settings
from app.services.slot_utils import get_service_duration, times_overlap
from app.services.staff_utils import get_my_staff_optional

router = APIRouter(prefix="/bookings", tags=["bookings"])


async def _get_owner_shop(user: User, db: AsyncSession) -> Shop:
    result = await db.execute(select(Shop).where(Shop.owner_id == user.id))
    shop = result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.get("/my-shop", response_model=List[BookingOut])
async def get_shop_bookings(
    status: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    staff_id: Optional[int] = Query(None, description="Owner only: filter by staff member"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Staff sees own bookings. Owner sees all (optionally filtered by staff_id)."""
    my_staff = await get_my_staff_optional(current_user, db)
    if my_staff is None:
        raise HTTPException(status_code=404, detail="No active staff record found")

    # Determine if this user is a shop owner
    owner_shop_result = await db.execute(select(Shop).where(Shop.owner_id == current_user.id))
    owner_shop = owner_shop_result.scalar_one_or_none()
    is_owner = owner_shop is not None and owner_shop.id == my_staff.shop_id

    query = (
        select(Booking)
        .where(Booking.shop_id == my_staff.shop_id)
        .order_by(Booking.booking_date, Booking.time_slot)
    )

    if is_owner:
        # Owner can filter by a specific staff member
        if staff_id is not None:
            query = query.where(Booking.staff_id == staff_id)
    else:
        # Staff only sees their own bookings
        query = query.where(Booking.staff_id == my_staff.id)

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
    """Book a slot (called by customers via the mini app or bot)."""
    shop_result = await db.execute(select(Shop).where(Shop.id == data.shop_id))
    shop = shop_result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status_code=404, detail="Shop not found")

    # Resolve staff: use provided staff_id or fall back to owner's staff record
    target_staff_id = data.staff_id
    if target_staff_id is None:
        # Fall back to the shop owner's staff record
        owner_staff_result = await db.execute(
            select(Staff).where(Staff.shop_id == data.shop_id, Staff.user_id == shop.owner_id)
        )
        owner_staff = owner_staff_result.scalar_one_or_none()
        if owner_staff:
            target_staff_id = owner_staff.id
    else:
        # Verify the staff belongs to this shop
        staff_check = await db.execute(
            select(Staff).where(Staff.id == target_staff_id, Staff.shop_id == data.shop_id, Staff.is_active == True)
        )
        if staff_check.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Staff member not found in this shop")

    req_duration = get_service_duration(shop, data.service_type)

    # Conflict check scoped to the target staff member
    active_result = await db.execute(
        select(Booking).where(
            Booking.staff_id == target_staff_id,
            Booking.booking_date == data.booking_date,
            Booking.status.in_(["pending", "confirmed"]),
        )
    )
    active_bookings = active_result.scalars().all()

    for b in active_bookings:
        b_duration = get_service_duration(shop, b.service_type)
        if times_overlap(data.time_slot, req_duration, b.time_slot, b_duration):
            raise HTTPException(status_code=409, detail="This time slot is not available")

    booking = Booking(
        customer_id=current_user.id,
        staff_id=target_staff_id,
        **data.model_dump(exclude={"staff_id"}),
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)

    # Notify the assigned staff member
    if target_staff_id:
        assigned_staff_result = await db.execute(select(Staff).where(Staff.id == target_staff_id))
        assigned_staff = assigned_staff_result.scalar_one_or_none()
        if assigned_staff:
            barber_result = await db.execute(select(User).where(User.id == assigned_staff.user_id))
            barber = barber_result.scalar_one_or_none()
            if barber:
                asyncio.create_task(notify_barber_new_booking(
                    barber_telegram_id=barber.telegram_id,
                    customer_name=data.customer_name,
                    customer_phone=data.customer_phone,
                    booking_date=str(data.booking_date),
                    time_slot=data.time_slot,
                    barber_language=barber.language,
                ))

    return booking


@router.patch("/{booking_id}/status", response_model=BookingOut)
async def update_booking_status(
    booking_id: int,
    body: BookingStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Staff/owner updates booking status (confirm / complete / cancel / no_show)."""
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Use one of {VALID_STATUSES}")

    my_staff = await get_my_staff_optional(current_user, db)
    if my_staff is None:
        raise HTTPException(status_code=404, detail="No active staff record found")

    # Determine ownership
    owner_shop_result = await db.execute(select(Shop).where(Shop.owner_id == current_user.id))
    owner_shop = owner_shop_result.scalar_one_or_none()
    is_owner = owner_shop is not None and owner_shop.id == my_staff.shop_id

    if is_owner:
        # Owner can update any booking in their shop
        result = await db.execute(
            select(Booking).where(Booking.id == booking_id, Booking.shop_id == my_staff.shop_id)
        )
    else:
        # Staff can only update their own bookings
        result = await db.execute(
            select(Booking).where(Booking.id == booking_id, Booking.staff_id == my_staff.id)
        )

    booking = result.scalar_one_or_none()
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking.status = body.status
    await db.commit()
    await db.refresh(booking)

    # Notify the customer
    shop_result = await db.execute(select(Shop).where(Shop.id == booking.shop_id))
    shop = shop_result.scalar_one_or_none()
    if booking.customer_id and body.status in ("confirmed", "cancelled", "completed") and shop:
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
            if body.status == "completed":
                asyncio.create_task(send_review_request(
                    customer_telegram_id=customer.telegram_id,
                    booking_id=booking.id,
                    shop_name=shop.name,
                    mini_app_url=settings.MINI_APP_URL,
                    customer_language=customer.language,
                ))

    return booking


@router.post("/{booking_id}/message")
async def send_message_to_customer(
    booking_id: int,
    data: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Barber sends a free-form message to the customer via Telegram."""
    my_staff = await get_my_staff_optional(current_user, db)
    if my_staff is None:
        raise HTTPException(status_code=404, detail="No active staff record found")

    owner_shop_result = await db.execute(select(Shop).where(Shop.owner_id == current_user.id))
    owner_shop = owner_shop_result.scalar_one_or_none()
    is_owner = owner_shop is not None and owner_shop.id == my_staff.shop_id

    if is_owner:
        result = await db.execute(
            select(Booking).where(Booking.id == booking_id, Booking.shop_id == my_staff.shop_id)
        )
    else:
        result = await db.execute(
            select(Booking).where(Booking.id == booking_id, Booking.staff_id == my_staff.id)
        )

    booking = result.scalar_one_or_none()
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not booking.customer_id:
        raise HTTPException(status_code=400, detail="no_telegram")

    customer_result = await db.execute(select(User).where(User.id == booking.customer_id))
    customer = customer_result.scalar_one_or_none()
    if not customer or not customer.telegram_id:
        raise HTTPException(status_code=400, detail="no_telegram")

    shop_result = await db.execute(select(Shop).where(Shop.id == booking.shop_id))
    shop = shop_result.scalar_one_or_none()

    await notify_barber_message(
        customer_telegram_id=customer.telegram_id,
        shop_name=shop.name if shop else "",
        message=data.message,
        customer_language=customer.language,
    )
    return {"ok": True}


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

    # Notify the assigned staff member (or fall back to shop owner)
    notified = False
    if booking.staff_id:
        assigned_result = await db.execute(select(Staff).where(Staff.id == booking.staff_id))
        assigned = assigned_result.scalar_one_or_none()
        if assigned:
            barber_result = await db.execute(select(User).where(User.id == assigned.user_id))
            barber = barber_result.scalar_one_or_none()
            if barber:
                asyncio.create_task(notify_barber_customer_cancelled(
                    barber_telegram_id=barber.telegram_id,
                    customer_name=booking.customer_name,
                    customer_phone=booking.customer_phone,
                    booking_date=str(booking.booking_date),
                    time_slot=booking.time_slot,
                    barber_language=barber.language,
                ))
                notified = True

    if not notified:
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
