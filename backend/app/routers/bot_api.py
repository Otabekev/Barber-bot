"""
Endpoints called by the Telegram bot (not by the Mini App).
Authenticated with X-Bot-Secret header instead of JWT.
"""
from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.booking import Booking
from app.schemas.shop import ShopOut
from app.services.notifications import notify_barber_customer_cancelled

router = APIRouter(prefix="/bot", tags=["bot"])


def _verify_bot_secret(x_bot_secret: str = Header(...)):
    if x_bot_secret != settings.BOT_SECRET:
        raise HTTPException(status_code=403, detail="Invalid bot secret")


@router.post("/set-language")
async def set_language(
    body: dict,
    _: None = Depends(_verify_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    """Bot calls this when a user picks a language."""
    telegram_id = body.get("telegram_id")
    language = body.get("language")
    full_name = body.get("full_name", "")
    if not telegram_id or language not in ("uz", "ru", "en"):
        raise HTTPException(status_code=400, detail="Invalid payload")

    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()
    if user:
        user.language = language
    else:
        user = User(telegram_id=telegram_id, full_name=full_name, language=language)
        db.add(user)
    await db.commit()
    return {"ok": True}


@router.get("/shops", response_model=List[ShopOut])
async def get_shops_by_region(
    region: str,
    _: None = Depends(_verify_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    """Bot calls this to get approved shops in a region."""
    result = await db.execute(
        select(Shop).where(
            Shop.region == region,
            Shop.is_approved == True,
            Shop.is_active == True,
        ).order_by(Shop.name)
    )
    return result.scalars().all()


@router.get("/barber-today")
async def barber_today_schedule(
    telegram_id: int,
    _: None = Depends(_verify_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    """Bot calls this for /bugun command — returns today's bookings for a barber."""
    user_result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = user_result.scalar_one_or_none()
    if not user:
        return {"bookings": [], "message": "not_registered"}

    shop_result = await db.execute(select(Shop).where(Shop.owner_id == user.id))
    shop = shop_result.scalar_one_or_none()
    if not shop:
        return {"bookings": [], "message": "no_shop"}

    today = date.today()
    bookings_result = await db.execute(
        select(Booking).where(
            Booking.shop_id == shop.id,
            Booking.booking_date == today,
            Booking.status.in_(["pending", "confirmed"]),
        ).order_by(Booking.time_slot)
    )
    bookings = bookings_result.scalars().all()

    return {
        "shop_name": shop.name,
        "date": str(today),
        "bookings": [
            {
                "time": b.time_slot,
                "name": b.customer_name,
                "phone": b.customer_phone,
                "status": b.status,
            }
            for b in bookings
        ],
    }


@router.post("/cancel-from-reminder")
async def cancel_from_reminder(
    body: dict,
    _: None = Depends(_verify_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    """
    Bot calls this when user presses 'Can't make it' on the reminder message.
    Cancels the booking and notifies the barber.
    """
    booking_id = body.get("booking_id")
    telegram_id = body.get("telegram_id")
    if not booking_id or not telegram_id:
        raise HTTPException(status_code=400, detail="booking_id and telegram_id required")

    # Find booking owned by this customer
    user_result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    booking_result = await db.execute(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.customer_id == user.id,
        )
    )
    booking = booking_result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status in ("cancelled", "completed"):
        return {"ok": True, "already": True}

    booking.status = "cancelled"
    await db.commit()
    await db.refresh(booking)

    # Notify barber
    shop_result = await db.execute(select(Shop).where(Shop.id == booking.shop_id))
    shop = shop_result.scalar_one_or_none()
    if shop:
        owner_result = await db.execute(select(User).where(User.id == shop.owner_id))
        owner = owner_result.scalar_one_or_none()
        if owner:
            import asyncio
            asyncio.create_task(notify_barber_customer_cancelled(
                barber_telegram_id=owner.telegram_id,
                customer_name=booking.customer_name,
                customer_phone=booking.customer_phone,
                booking_date=str(booking.booking_date),
                time_slot=booking.time_slot,
                barber_language=owner.language,
            ))

    return {"ok": True, "already": False}
