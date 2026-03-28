from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.work_schedule import WorkSchedule
from app.schemas.work_schedule import ScheduleUpdate, ScheduleOut

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
    shop = await _get_owner_shop(current_user, db)
    result = await db.execute(
        select(WorkSchedule)
        .where(WorkSchedule.shop_id == shop.id)
        .order_by(WorkSchedule.day_of_week)
    )
    return result.scalars().all()


@router.put("/my", response_model=List[ScheduleOut])
async def update_schedule(
    data: ScheduleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Replace the full week schedule for the current user's shop."""
    shop = await _get_owner_shop(current_user, db)

    # Validate no duplicate days
    days = [item.day_of_week for item in data.schedules]
    if len(days) != len(set(days)):
        raise HTTPException(status_code=400, detail="Duplicate day_of_week entries")

    await db.execute(delete(WorkSchedule).where(WorkSchedule.shop_id == shop.id))

    new_rows: List[WorkSchedule] = []
    for item in data.schedules:
        ws = WorkSchedule(shop_id=shop.id, **item.model_dump())
        db.add(ws)
        new_rows.append(ws)

    await db.commit()
    for ws in new_rows:
        await db.refresh(ws)

    return sorted(new_rows, key=lambda x: x.day_of_week)
