from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.booking import Booking
from app.models.staff import Staff
from app.schemas.shop import ShopOut
from app.schemas.user import UserOut
from app.schemas.staff import StaffOut

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
    shop.is_rejected = False
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
    shop.is_rejected = True
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


@router.get("/staff", response_model=List[StaffOut])
async def admin_get_pending_staff(
    _: User = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Pending + all staff records for admin review."""
    result = await db.execute(
        select(Staff)
        .options(selectinload(Staff.user))
        .order_by(Staff.is_approved, Staff.id.desc())
    )
    staff_list = result.scalars().all()
    outputs = []
    for s in staff_list:
        out = StaffOut.model_validate(s)
        outputs.append(out)
    return outputs


@router.patch("/staff/{staff_id}/approve", response_model=StaffOut)
async def admin_approve_staff(
    staff_id: int,
    _: User = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Staff).options(selectinload(Staff.user)).where(Staff.id == staff_id)
    )
    staff = result.scalar_one_or_none()
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff not found")
    staff.is_approved = True
    staff.is_rejected = False
    await db.commit()
    await db.refresh(staff)

    # Notify staff member and shop owner
    try:
        shop_result = await db.execute(select(Shop).where(Shop.id == staff.shop_id))
        shop = shop_result.scalar_one_or_none()
        user_result = await db.execute(select(User).where(User.id == staff.user_id))
        staff_user = user_result.scalar_one_or_none()
        owner_result = await db.execute(select(User).where(User.id == shop.owner_id)) if shop else None

        from app.services.notifications import notify_staff_approved, notify_owner_staff_joined
        if staff_user:
            await notify_staff_approved(staff_user.telegram_id, shop.name if shop else "", staff_user.language)
        if owner_result and shop and staff_user:
            owner = (await owner_result).scalar_one_or_none()
            if owner and owner.id != staff.user_id:
                await notify_owner_staff_joined(owner.telegram_id, staff_user.full_name, owner.language)
    except Exception:
        pass

    return StaffOut.model_validate(staff)


@router.patch("/staff/{staff_id}/reject", response_model=StaffOut)
async def admin_reject_staff(
    staff_id: int,
    _: User = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Staff).options(selectinload(Staff.user)).where(Staff.id == staff_id)
    )
    staff = result.scalar_one_or_none()
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff not found")
    staff.is_approved = False
    staff.is_rejected = True
    await db.commit()
    await db.refresh(staff)

    try:
        shop_result = await db.execute(select(Shop).where(Shop.id == staff.shop_id))
        shop = shop_result.scalar_one_or_none()
        user_result = await db.execute(select(User).where(User.id == staff.user_id))
        staff_user = user_result.scalar_one_or_none()

        from app.services.notifications import notify_staff_rejected
        if staff_user:
            await notify_staff_rejected(staff_user.telegram_id, shop.name if shop else "", staff_user.language)
    except Exception:
        pass

    return StaffOut.model_validate(staff)


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
