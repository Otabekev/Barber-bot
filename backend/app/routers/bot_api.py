"""
Endpoints called by the Telegram bot (not by the Mini App).
Authenticated with X-Bot-Secret header instead of JWT.
"""
from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.staff import Staff
from app.models.booking import Booking
from app.models.work_schedule import WorkSchedule
from app.models.blocked_slot import BlockedSlot
from app.models.review import Review
from app.schemas.shop import ShopOut
from app.services.notifications import notify_barber_customer_cancelled
from app.services.slot_utils import get_service_duration, times_overlap

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


@router.get("/districts")
async def get_districts(
    region: str,
    _: None = Depends(_verify_bot_secret),
):
    """Bot calls this to get districts for a given region."""
    from app.schemas.shop import UZBEKISTAN_DISTRICTS
    districts = UZBEKISTAN_DISTRICTS.get(region, [])
    return {"region": region, "districts": districts}


@router.get("/shops")
async def get_shops_by_region(
    region: str,
    district: str | None = None,
    _: None = Depends(_verify_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    """Bot calls this to get approved shops in a region (optionally filtered by district)."""
    conditions = [
        Shop.region == region,
        Shop.is_approved == True,
        Shop.is_active == True,
    ]
    if district:
        conditions.append(Shop.district == district)
    result = await db.execute(
        select(Shop).where(*conditions).order_by(Shop.name)
    )
    shops_list = result.scalars().all()
    if not shops_list:
        return []

    # Compute average ratings for all fetched shops in one query
    shop_ids = [s.id for s in shops_list]
    rating_result = await db.execute(
        select(
            Review.shop_id,
            func.avg(Review.rating).label("avg"),
            func.count(Review.id).label("cnt"),
        ).where(Review.shop_id.in_(shop_ids)).group_by(Review.shop_id)
    )
    ratings = {row.shop_id: (round(float(row.avg), 1), row.cnt) for row in rating_result}

    # Fetch active approved staff for all shops in one query
    staff_result = await db.execute(
        select(Staff).where(
            Staff.shop_id.in_(shop_ids),
            Staff.is_active == True,
            Staff.is_approved == True,
        ).order_by(Staff.created_at)
    )
    staff_by_shop: dict = {}
    for s in staff_result.scalars().all():
        staff_by_shop.setdefault(s.shop_id, []).append({"id": s.id, "display_name": s.display_name})

    out = []
    for shop in shops_list:
        d = ShopOut.model_validate(shop).model_dump()
        avg, cnt = ratings.get(shop.id, (None, 0))
        d["avg_rating"] = avg
        d["review_count"] = cnt
        d["staff"] = staff_by_shop.get(shop.id, [])
        out.append(d)
    return out


@router.get("/barber-today")
async def barber_today_schedule(
    telegram_id: int,
    _: None = Depends(_verify_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    """Bot calls this for /bugun command — returns today's bookings for a barber (by staff record)."""
    user_result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = user_result.scalar_one_or_none()
    if not user:
        return {"bookings": [], "message": "not_registered"}

    # Look up their staff record
    staff_result = await db.execute(
        select(Staff).where(
            Staff.user_id == user.id,
            Staff.is_active == True,
            Staff.is_approved == True,
        )
    )
    staff = staff_result.scalar_one_or_none()
    if not staff:
        return {"bookings": [], "message": "no_shop"}

    shop_result = await db.execute(select(Shop).where(Shop.id == staff.shop_id))
    shop = shop_result.scalar_one_or_none()

    today = date.today()
    bookings_result = await db.execute(
        select(Booking).where(
            Booking.staff_id == staff.id,
            Booking.booking_date == today,
            Booking.status.in_(["pending", "confirmed"]),
        ).order_by(Booking.time_slot)
    )
    bookings = bookings_result.scalars().all()

    return {
        "shop_name": shop.name if shop else "",
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


@router.get("/quick-slots")
async def get_quick_slots(
    shop_id: int = Query(...),
    date_str: str = Query(..., alias="date"),
    service: str = Query("haircut"),
    staff_id: int | None = Query(None),
    _: None = Depends(_verify_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    """
    Bot calls this to get available slots for a shop/staff on a given date.
    Returns up to 10 slot strings for display as inline keyboard buttons.
    """
    shop_result = await db.execute(select(Shop).where(Shop.id == shop_id, Shop.is_approved == True))
    shop = shop_result.scalar_one_or_none()
    if not shop:
        return {"slots": []}

    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        return {"slots": []}

    # Resolve staff
    target_staff_id = staff_id
    if target_staff_id is None:
        owner_staff = await db.execute(
            select(Staff).where(Staff.shop_id == shop_id, Staff.user_id == shop.owner_id)
        )
        owner_s = owner_staff.scalar_one_or_none()
        if owner_s:
            target_staff_id = owner_s.id

    weekday = target_date.weekday()
    sched_result = await db.execute(
        select(WorkSchedule).where(
            WorkSchedule.staff_id == target_staff_id,
            WorkSchedule.day_of_week == weekday,
            WorkSchedule.is_working == True,
        )
    )
    schedule = sched_result.scalar_one_or_none()
    if not schedule:
        return {"slots": []}

    svc_duration = get_service_duration(shop, service)
    interval = shop.slot_duration
    if shop.beard_duration:
        interval = min(shop.slot_duration, shop.beard_duration)

    open_h, open_m = map(int, schedule.open_time.split(":"))
    close_h, close_m = map(int, schedule.close_time.split(":"))
    open_minutes = open_h * 60 + open_m
    close_minutes = close_h * 60 + close_m

    bookings_result = await db.execute(
        select(Booking).where(
            Booking.staff_id == target_staff_id,
            Booking.booking_date == target_date,
            Booking.status.in_(["pending", "confirmed"]),
        )
    )
    active_bookings = bookings_result.scalars().all()

    blocked_result = await db.execute(
        select(BlockedSlot).where(
            BlockedSlot.staff_id == target_staff_id,
            BlockedSlot.block_date == target_date,
        )
    )
    blocked_times = {b.time_slot for b in blocked_result.scalars().all()}

    available = []
    cur = open_minutes
    while cur + svc_duration <= close_minutes:
        h, m = divmod(cur, 60)
        slot_str = f"{h:02d}:{m:02d}"

        if slot_str not in blocked_times:
            overlaps = False
            for b in active_bookings:
                b_dur = get_service_duration(shop, b.service_type)
                if times_overlap(slot_str, svc_duration, b.time_slot, b_dur):
                    overlaps = True
                    break
            if not overlaps:
                available.append(slot_str)

        cur += interval

    return {"slots": available[:10]}


@router.post("/set-shop-location")
async def set_shop_location(
    body: dict,
    _: None = Depends(_verify_bot_secret),
    db: AsyncSession = Depends(get_db),
):
    """Bot calls this after barber shares location via /setlocation command."""
    telegram_id = body.get("telegram_id")
    latitude = body.get("latitude")
    longitude = body.get("longitude")
    if not telegram_id or latitude is None or longitude is None:
        raise HTTPException(status_code=400, detail="telegram_id, latitude, longitude required")

    user_result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    shop_result = await db.execute(select(Shop).where(Shop.owner_id == user.id))
    shop = shop_result.scalar_one_or_none()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    shop.latitude = latitude
    shop.longitude = longitude
    await db.commit()
    return {"ok": True}


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

    # Notify the assigned staff member (or fall back to shop owner)
    import asyncio
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

    return {"ok": True, "already": False}
