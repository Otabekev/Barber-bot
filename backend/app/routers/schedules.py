from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.staff import Staff
from app.models.work_schedule import WorkSchedule
from app.schemas.work_schedule import ScheduleUpdate, ScheduleOut
from app.services.staff_utils import get_my_staff, require_owner, get_staff_for_shop

router = APIRouter(prefix="/schedules", tags=["schedules"])


async def _get_owner_shop(user: User, db: AsyncSession) -> Shop:
    result = await db.execute(select(Shop).where(Shop.owner_id == user.id))
    shop = result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status_code=404, detail="Shop not found. Create your shop first.")
    return shop


@router.get("/my", response_model=List[ScheduleOut])
async def get_my_schedule(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current staff member's own schedule."""
    staff = await get_my_staff(current_user, db)
    result = await db.execute(
        select(WorkSchedule)
        .where(WorkSchedule.staff_id == staff.id)
        .order_by(WorkSchedule.day_of_week)
    )
    return result.scalars().all()


@router.put("/my", response_model=List[ScheduleOut])
async def update_schedule(
    data: ScheduleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Replace the full week schedule for the current staff member."""
    staff = await get_my_staff(current_user, db)

    days = [item.day_of_week for item in data.schedules]
    if len(days) != len(set(days)):
        raise HTTPException(status_code=400, detail="Duplicate day_of_week entries")

    await db.execute(delete(WorkSchedule).where(WorkSchedule.staff_id == staff.id))

    new_rows: List[WorkSchedule] = []
    for item in data.schedules:
        ws = WorkSchedule(shop_id=staff.shop_id, staff_id=staff.id, **item.model_dump())
        db.add(ws)
        new_rows.append(ws)

    await db.commit()
    for ws in new_rows:
        await db.refresh(ws)

    return sorted(new_rows, key=lambda x: x.day_of_week)


# ─── owner: manage another staff member's schedule ────────────────────────────

@router.get("/staff/{staff_id}", response_model=List[ScheduleOut])
async def get_staff_schedule(
    staff_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Owner only: get a specific staff member's schedule."""
    shop = await _get_owner_shop(current_user, db)
    s = await get_staff_for_shop(staff_id, shop.id, db)
    result = await db.execute(
        select(WorkSchedule)
        .where(WorkSchedule.staff_id == s.id)
        .order_by(WorkSchedule.day_of_week)
    )
    return result.scalars().all()


@router.put("/staff/{staff_id}", response_model=List[ScheduleOut])
async def update_staff_schedule(
    staff_id: int,
    data: ScheduleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Owner only: replace a specific staff member's schedule."""
    shop = await _get_owner_shop(current_user, db)
    s = await get_staff_for_shop(staff_id, shop.id, db)

    days = [item.day_of_week for item in data.schedules]
    if len(days) != len(set(days)):
        raise HTTPException(status_code=400, detail="Duplicate day_of_week entries")

    await db.execute(delete(WorkSchedule).where(WorkSchedule.staff_id == s.id))

    new_rows: List[WorkSchedule] = []
    for item in data.schedules:
        ws = WorkSchedule(shop_id=shop.id, staff_id=s.id, **item.model_dump())
        db.add(ws)
        new_rows.append(ws)

    await db.commit()
    for ws in new_rows:
        await db.refresh(ws)

    return sorted(new_rows, key=lambda x: x.day_of_week)
