from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.booking import Booking
from app.schemas.shop import ShopOut
from app.schemas.user import UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/shops", response_model=List[ShopOut])
async def admin_get_shops(
    _: User = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    """All shops with their approval status."""
    result = await db.execute(select(Shop).order_by(Shop.is_approved, Shop.id.desc()))
    return result.scalars().all()


@router.patch("/shops/{shop_id}/approve", response_model=ShopOut)
async def admin_approve_shop(
    shop_id: int,
    _: User = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status_code=404, detail="Shop not found")
    shop.is_approved = True
    await db.commit()
    await db.refresh(shop)
    return shop


@router.patch("/shops/{shop_id}/reject", response_model=ShopOut)
async def admin_reject_shop(
    shop_id: int,
    _: User = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status_code=404, detail="Shop not found")
    shop.is_approved = False
    await db.commit()
    await db.refresh(shop)
    return shop


@router.get("/users", response_model=List[UserOut])
async def admin_get_users(
    _: User = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.id.desc()))
    return result.scalars().all()


@router.get("/stats")
async def admin_get_stats(
    _: User = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    total_users = (await db.execute(select(func.count(User.id)))).scalar()
    total_shops = (await db.execute(select(func.count(Shop.id)))).scalar()
    pending_shops = (await db.execute(
        select(func.count(Shop.id)).where(Shop.is_approved == False)
    )).scalar()
    total_bookings = (await db.execute(select(func.count(Booking.id)))).scalar()
    return {
        "total_users": total_users,
        "total_shops": total_shops,
        "pending_approval": pending_shops,
        "total_bookings": total_bookings,
    }
