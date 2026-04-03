from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import undefer

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.work_schedule import WorkSchedule
from app.models.booking import Booking
from app.models.blocked_slot import BlockedSlot
from app.models.staff import Staff
from app.schemas.shop import ShopCreate, ShopUpdate, ShopOut, UZBEKISTAN_REGIONS
from app.services.slot_utils import get_service_duration, times_overlap

router = APIRouter(prefix="/shops", tags=["shops"])


@router.get("/regions")
async def get_regions():
    """Return the list of Uzbekistan regions (used by bot and frontend)."""
    return {"regions": UZBEKISTAN_REGIONS}


@router.get("/by-region", response_model=list[ShopOut])
async def get_shops_by_region(
    region: str,
    db: AsyncSession = Depends(get_db),
):
    """Public: return approved shops in a region (used by bot)."""
    result = await db.execute(
        select(Shop).where(
            Shop.region == region,
            Shop.is_approved == True,
            Shop.is_active == True,
        ).order_by(Shop.name)
    )
    return result.scalars().all()


async def _get_owner_shop(user: User, db: AsyncSession) -> Shop:
    result = await db.execute(select(Shop).where(Shop.owner_id == user.id))
    shop = result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.get("/my", response_model=ShopOut)
async def get_my_shop(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_owner_shop(current_user, db)


@router.post("/", response_model=ShopOut, status_code=201)
async def create_shop(
    data: ShopCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Shop).where(Shop.owner_id == current_user.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a shop")

    shop = Shop(owner_id=current_user.id, **data.model_dump())
    db.add(shop)
    await db.commit()
    await db.refresh(shop)
    return shop


@router.put("/my", response_model=ShopOut)
async def update_shop(
    data: ShopUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop = await _get_owner_shop(current_user, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(shop, field, value)
    await db.commit()
    await db.refresh(shop)
    return shop


@router.post("/my/photo", response_model=ShopOut)
async def upload_shop_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload or replace the shop's cover photo (max 3 MB)."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    content = await file.read()
    if len(content) > 3 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 3 MB)")
    shop = await _get_owner_shop(current_user, db)
    shop.photo = content
    shop.photo_mime = file.content_type
    shop.has_photo = True
    await db.commit()
    await db.refresh(shop)
    return shop


@router.delete("/my/photo", response_model=ShopOut)
async def delete_shop_photo(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove the shop's cover photo."""
    shop = await _get_owner_shop(current_user, db)
    shop.photo = None
    shop.photo_mime = None
    shop.has_photo = False
    await db.commit()
    await db.refresh(shop)
    return shop


@router.get("/{shop_id}/photo")
async def get_shop_photo(shop_id: int, db: AsyncSession = Depends(get_db)):
    """Public: serve the shop's cover photo."""
    result = await db.execute(
        select(Shop).options(undefer(Shop.photo)).where(Shop.id == shop_id)
    )
    shop = result.scalar_one_or_none()
    if not shop or not shop.has_photo or not shop.photo:
        raise HTTPException(status_code=404, detail="No photo")
    return Response(content=shop.photo, media_type=shop.photo_mime or "image/jpeg")


@router.get("/{shop_id}/public")
async def get_shop_public(shop_id: int, db: AsyncSession = Depends(get_db)):
    """Public: lightweight shop info + active approved staff list used by the booking flow."""
    result = await db.execute(select(Shop).where(Shop.id == shop_id, Shop.is_active == True))
    shop = result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status_code=404, detail="Shop not found")

    staff_result = await db.execute(
        select(Staff).where(
            Staff.shop_id == shop_id,
            Staff.is_active == True,
            Staff.is_approved == True,
        ).order_by(Staff.created_at)
    )
    staff_list = staff_result.scalars().all()

    return {
        "id": shop.id,
        "name": shop.name,
        "slot_duration": shop.slot_duration,
        "beard_duration": shop.beard_duration,
        "staff": [
            {
                "id": s.id,
                "display_name": s.display_name,
                "has_photo": s.has_photo,
            }
            for s in staff_list
        ],
    }


@router.get("/{shop_id}/available-slots")
async def get_available_slots(
    shop_id: int,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    service_type: str = Query("haircut", description="Service type: haircut | beard | combo"),
    staff_id: Optional[int] = Query(None, description="Staff member ID to check availability for"),
    db: AsyncSession = Depends(get_db),
):
    """Return available start times for a given service type on a given date (scoped to staff_id)."""
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")

    result = await db.execute(select(Shop).where(Shop.id == shop_id, Shop.is_active == True))
    shop = result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status_code=404, detail="Shop not found")

    # Resolve which staff member's schedule/slots to use
    target_staff_id = staff_id
    if target_staff_id is None:
        owner_staff = await db.execute(
            select(Staff).where(Staff.shop_id == shop_id, Staff.user_id == shop.owner_id)
        )
        owner_s = owner_staff.scalar_one_or_none()
        if owner_s:
            target_staff_id = owner_s.id

    day_of_week = target_date.weekday()
    sched_result = await db.execute(
        select(WorkSchedule).where(
            WorkSchedule.staff_id == target_staff_id,
            WorkSchedule.day_of_week == day_of_week,
            WorkSchedule.is_working == True,
        )
    )
    schedule = sched_result.scalar_one_or_none()
    if schedule is None:
        return {"date": date, "slots": [], "all_slots": [], "blocked": []}

    open_h, open_m = map(int, schedule.open_time.split(":"))
    close_h, close_m = map(int, schedule.close_time.split(":"))
    current_dt = datetime(2000, 1, 1, open_h, open_m)
    end_dt = datetime(2000, 1, 1, close_h, close_m)

    interval = shop.slot_duration
    if shop.beard_duration:
        interval = min(shop.slot_duration, shop.beard_duration)

    all_slots: list[str] = []
    while current_dt < end_dt:
        all_slots.append(current_dt.strftime("%H:%M"))
        current_dt += timedelta(minutes=interval)

    req_duration = get_service_duration(shop, service_type)

    # Fetch active bookings for this staff member on this date
    bookings_result = await db.execute(
        select(Booking).where(
            Booking.staff_id == target_staff_id,
            Booking.booking_date == target_date,
            Booking.status.in_(["pending", "confirmed"]),
        )
    )
    active_bookings = bookings_result.scalars().all()

    # Fetch blocked slots for this staff member
    blocked_result = await db.execute(
        select(BlockedSlot.time_slot).where(
            BlockedSlot.staff_id == target_staff_id,
            BlockedSlot.block_date == target_date,
        )
    )
    blocked = {row[0] for row in blocked_result.all()}

    available: list[str] = []
    for slot in all_slots:
        if slot in blocked:
            continue
        slot_end_dt = datetime.strptime(slot, "%H:%M") + timedelta(minutes=req_duration)
        if slot_end_dt > end_dt:
            continue
        overlaps = any(
            times_overlap(slot, req_duration, b.time_slot, get_service_duration(shop, b.service_type))
            for b in active_bookings
        )
        if not overlaps:
            available.append(slot)

    return {"date": date, "slots": available, "all_slots": all_slots, "blocked": list(blocked)}
