from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional
from datetime import date

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.blocked_slot import BlockedSlot
from app.schemas.blocked_slot import BlockSlotCreate, UnblockSlotRequest, BlockedSlotOut

router = APIRouter(prefix="/slots", tags=["slots"])


async def _get_owner_shop(user: User, db: AsyncSession) -> Shop:
    result = await db.execute(select(Shop).where(Shop.owner_id == user.id))
    shop = result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.get("/blocked", response_model=List[BlockedSlotOut])
async def get_blocked_slots(
    from_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop = await _get_owner_shop(current_user, db)

    query = (
        select(BlockedSlot)
        .where(BlockedSlot.shop_id == shop.id)
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
    """Block one or more time slots on a given date."""
    shop = await _get_owner_shop(current_user, db)

    created: List[BlockedSlot] = []
    for time_slot in data.time_slots:
        existing = await db.execute(
            select(BlockedSlot).where(
                BlockedSlot.shop_id == shop.id,
                BlockedSlot.block_date == data.block_date,
                BlockedSlot.time_slot == time_slot,
            )
        )
        if existing.scalar_one_or_none() is None:
            bs = BlockedSlot(
                shop_id=shop.id, block_date=data.block_date, time_slot=time_slot
            )
            db.add(bs)
            created.append(bs)

    await db.commit()
    for bs in created:
        await db.refresh(bs)
    return created


@router.post("/unblock", status_code=200)
async def unblock_slots(
    data: UnblockSlotRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unblock specific time slots on a given date."""
    shop = await _get_owner_shop(current_user, db)

    await db.execute(
        delete(BlockedSlot).where(
            BlockedSlot.shop_id == shop.id,
            BlockedSlot.block_date == data.block_date,
            BlockedSlot.time_slot.in_(data.time_slots),
        )
    )
    await db.commit()
    return {"message": f"Unblocked {len(data.time_slots)} slot(s)"}
