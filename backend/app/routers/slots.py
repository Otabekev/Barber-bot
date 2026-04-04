from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func as sql_func
from typing import List, Optional
from datetime import date, timedelta, datetime
from pydantic import BaseModel

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.staff import Staff
from app.models.work_schedule import WorkSchedule
from app.models.blocked_slot import BlockedSlot
from app.schemas.blocked_slot import BlockSlotCreate, UnblockSlotRequest, BlockedSlotOut
from app.services.staff_utils import get_my_staff_owner_fallback, get_staff_for_shop

router = APIRouter(prefix="/slots", tags=["slots"])


async def _get_owner_shop(user: User, db: AsyncSession) -> Shop:
    result = await db.execute(select(Shop).where(Shop.owner_id == user.id))
    shop = result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


# ─── own blocked slots ─────────────────────────────────────────────────────────

@router.get("/blocked", response_model=List[BlockedSlotOut])
async def get_blocked_slots(
    from_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    staff = await get_my_staff_owner_fallback(current_user, db)
    if staff is None:
        raise HTTPException(status_code=404, detail="No staff record found")

    query = (
        select(BlockedSlot)
        .where(BlockedSlot.staff_id == staff.id)
        .order_by(BlockedSlot.block_date, BlockedSlot.time_slot)
    )
    if from_date:
        query = query.where(BlockedSlot.block_date >= from_date)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/block", response_model=List[BlockedSlotOut], status_code=201)
async def block_slots(
    data: BlockSlotCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Block one or more time slots on a given date for the current staff member."""
    staff = await get_my_staff_owner_fallback(current_user, db)
    if staff is None:
        raise HTTPException(status_code=404, detail="No staff record found")

    created: List[BlockedSlot] = []
    for time_slot in data.time_slots:
        existing = await db.execute(
            select(BlockedSlot).where(
                BlockedSlot.staff_id == staff.id,
                BlockedSlot.block_date == data.block_date,
                BlockedSlot.time_slot == time_slot,
            )
        )
        if existing.scalar_one_or_none() is None:
            bs = BlockedSlot(
                shop_id=staff.shop_id,
                staff_id=staff.id,
                block_date=data.block_date,
                time_slot=time_slot,
            )
            db.add(bs)
            created.append(bs)

    await db.commit()
    for bs in created:
        await db.refresh(bs)
    return created


class VacationRequest(BaseModel):
    start_date: date
    end_date: date


@router.post("/block-range", status_code=200)
async def block_date_range(
    data: VacationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Block ALL slots for every working day in [start_date, end_date] inclusive for the current staff member."""
    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")
    if (data.end_date - data.start_date).days > 60:
        raise HTTPException(status_code=400, detail="Range cannot exceed 60 days")

    staff = await get_my_staff_owner_fallback(current_user, db)
    if staff is None:
        raise HTTPException(status_code=404, detail="No staff record found")

    # Load the shop for slot_duration
    shop_result = await db.execute(select(Shop).where(Shop.id == staff.shop_id))
    shop = shop_result.scalar_one_or_none()

    # Load this staff member's work schedules
    sched_result = await db.execute(
        select(WorkSchedule).where(WorkSchedule.staff_id == staff.id)
    )
    schedules = {s.day_of_week: s for s in sched_result.scalars().all()}

    interval = shop.slot_duration if shop else 30
    if shop and shop.beard_duration:
        interval = min(shop.slot_duration, shop.beard_duration)

    blocked_count = 0
    current = data.start_date
    while current <= data.end_date:
        sched = schedules.get(current.weekday())
        if sched and sched.is_working:
            open_h, open_m = map(int, sched.open_time.split(":"))
            close_h, close_m = map(int, sched.close_time.split(":"))
            cur_dt = datetime(2000, 1, 1, open_h, open_m)
            end_dt = datetime(2000, 1, 1, close_h, close_m)
            while cur_dt < end_dt:
                slot_str = cur_dt.strftime("%H:%M")
                existing = await db.execute(
                    select(BlockedSlot).where(
                        BlockedSlot.staff_id == staff.id,
                        BlockedSlot.block_date == current,
                        BlockedSlot.time_slot == slot_str,
                    )
                )
                if existing.scalar_one_or_none() is None:
                    db.add(BlockedSlot(
                        shop_id=staff.shop_id,
                        staff_id=staff.id,
                        block_date=current,
                        time_slot=slot_str,
                    ))
                    blocked_count += 1
                cur_dt += timedelta(minutes=interval)

        current += timedelta(days=1)

    await db.commit()
    return {"blocked_count": blocked_count, "days": (data.end_date - data.start_date).days + 1}


@router.delete("/block-range", status_code=200)
async def unblock_date_range(
    data: VacationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove ALL blocked slots in [start_date, end_date] inclusive for the current staff member."""
    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")

    staff = await get_my_staff_owner_fallback(current_user, db)
    if staff is None:
        raise HTTPException(status_code=404, detail="No staff record found")

    current = data.start_date
    while current <= data.end_date:
        await db.execute(
            delete(BlockedSlot).where(
                BlockedSlot.staff_id == staff.id,
                BlockedSlot.block_date == current,
            )
        )
        current += timedelta(days=1)

    await db.commit()
    return {"message": "Range unblocked"}


@router.get("/blocked-dates")
async def get_blocked_dates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns each date that has at least one blocked slot for the current staff member."""
    staff = await get_my_staff_owner_fallback(current_user, db)
    if staff is None:
        raise HTTPException(status_code=404, detail="No staff record found")

    result = await db.execute(
        select(BlockedSlot.block_date, sql_func.count(BlockedSlot.id).label("count"))
        .where(BlockedSlot.staff_id == staff.id)
        .group_by(BlockedSlot.block_date)
        .order_by(BlockedSlot.block_date)
    )

    today = date.today()
    return [
        {
            "date": str(row.block_date),
            "count": row.count,
            "is_past": row.block_date < today,
            "is_today": row.block_date == today,
        }
        for row in result.all()
    ]


@router.post("/unblock", status_code=200)
async def unblock_slots(
    data: UnblockSlotRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unblock specific time slots on a given date."""
    staff = await get_my_staff_owner_fallback(current_user, db)
    if staff is None:
        raise HTTPException(status_code=404, detail="No staff record found")

    await db.execute(
        delete(BlockedSlot).where(
            BlockedSlot.staff_id == staff.id,
            BlockedSlot.block_date == data.block_date,
            BlockedSlot.time_slot.in_(data.time_slots),
        )
    )
    await db.commit()
    return {"message": f"Unblocked {len(data.time_slots)} slot(s)"}


# ─── owner: manage another staff member's blocked slots ───────────────────────

@router.get("/staff/{staff_id}/blocked", response_model=List[BlockedSlotOut])
async def get_staff_blocked_slots(
    staff_id: int,
    from_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop = await _get_owner_shop(current_user, db)
    s = await get_staff_for_shop(staff_id, shop.id, db)

    query = (
        select(BlockedSlot)
        .where(BlockedSlot.staff_id == s.id)
        .order_by(BlockedSlot.block_date, BlockedSlot.time_slot)
    )
    if from_date:
        query = query.where(BlockedSlot.block_date >= from_date)

    result = await db.execute(query)
    return result.scalars().all()
