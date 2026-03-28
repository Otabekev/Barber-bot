from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.work_schedule import WorkSchedule
from app.models.booking import Booking
from app.models.blocked_slot import BlockedSlot
from app.schemas.shop import ShopCreate, ShopUpdate, ShopOut, UZBEKISTAN_REGIONS

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
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(shop, field, value)
    await db.commit()
    await db.refresh(shop)
    return shop


@router.get("/{shop_id}/available-slots")
async def get_available_slots(
    shop_id: int,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    db: AsyncSession = Depends(get_db),
):
    """Return all available (not booked, not blocked) time slots for a shop on a given date."""
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")

    result = await db.execute(select(Shop).where(Shop.id == shop_id, Shop.is_active == True))
    shop = result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status_code=404, detail="Shop not found")

    day_of_week = target_date.weekday()  # 0=Monday
    sched_result = await db.execute(
        select(WorkSchedule).where(
            WorkSchedule.shop_id == shop_id,
            WorkSchedule.day_of_week == day_of_week,
            WorkSchedule.is_working == True,
        )
    )
    schedule = sched_result.scalar_one_or_none()
    if schedule is None:
        return {"date": date, "slots": []}

    # Generate all slots between open_time and close_time
    open_h, open_m = map(int, schedule.open_time.split(":"))
    close_h, close_m = map(int, schedule.close_time.split(":"))
    current_dt = datetime(2000, 1, 1, open_h, open_m)
    end_dt = datetime(2000, 1, 1, close_h, close_m)

    all_slots: list[str] = []
    while current_dt < end_dt:
        all_slots.append(current_dt.strftime("%H:%M"))
        current_dt += timedelta(minutes=shop.slot_duration)

    # Fetch booked slots
    bookings_result = await db.execute(
        select(Booking.time_slot).where(
            Booking.shop_id == shop_id,
            Booking.booking_date == target_date,
            Booking.status.in_(["pending", "confirmed"]),
        )
    )
    booked = {row[0] for row in bookings_result.all()}

    # Fetch blocked slots
    blocked_result = await db.execute(
        select(BlockedSlot.time_slot).where(
            BlockedSlot.shop_id == shop_id,
            BlockedSlot.block_date == target_date,
        )
    )
    blocked = {row[0] for row in blocked_result.all()}

    available = [s for s in all_slots if s not in booked and s not in blocked]
    return {"date": date, "slots": available, "all_slots": all_slots, "blocked": list(blocked)}
