"""Helper functions for staff/role resolution across routers."""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.models.shop import Shop
from app.models.staff import Staff


async def get_my_staff(user: User, db: AsyncSession) -> Staff:
    """Return the active, approved Staff record for this user. Raises 404 if none."""
    result = await db.execute(
        select(Staff).where(
            Staff.user_id == user.id,
            Staff.is_active == True,
            Staff.is_approved == True,
        )
    )
    staff = result.scalar_one_or_none()
    if staff is None:
        raise HTTPException(status_code=404, detail="No active staff record found. Make sure your account is approved.")
    return staff


async def get_my_staff_optional(user: User, db: AsyncSession) -> Staff | None:
    """Like get_my_staff but returns None instead of raising."""
    result = await db.execute(
        select(Staff).where(
            Staff.user_id == user.id,
            Staff.is_active == True,
            Staff.is_approved == True,
        )
    )
    return result.scalar_one_or_none()


async def get_my_staff_owner_fallback(user: User, db: AsyncSession) -> Staff | None:
    """Return approved staff record. For shop owners, auto-bootstraps a record if missing.

    This self-heals shops that were created before the multi-staff migration ran,
    or where the bootstrap INSERT failed silently. Non-owners still get None.
    """
    staff = await get_my_staff_optional(user, db)
    if staff:
        return staff

    # Only heal for shop owners
    shop_result = await db.execute(select(Shop).where(Shop.owner_id == user.id))
    shop = shop_result.scalar_one_or_none()
    if shop is None:
        return None

    # Check for an existing record that may be unapproved due to a missed bootstrap
    any_result = await db.execute(
        select(Staff).where(Staff.user_id == user.id, Staff.shop_id == shop.id)
    )
    existing = any_result.scalar_one_or_none()
    if existing:
        if not existing.is_approved or not existing.is_active:
            existing.is_approved = True
            existing.is_active = True
            await db.commit()
            await db.refresh(existing)
        return existing

    # No record at all: create one on demand (owner is always auto-approved)
    new_staff = Staff(
        shop_id=shop.id,
        user_id=user.id,
        display_name=user.full_name,
        is_active=True,
        is_approved=True,
        is_rejected=False,
    )
    db.add(new_staff)
    try:
        await db.commit()
        await db.refresh(new_staff)
        return new_staff
    except Exception:
        # Concurrent request may have already created the record
        await db.rollback()
        retry = await db.execute(
            select(Staff).where(Staff.user_id == user.id, Staff.shop_id == shop.id)
        )
        return retry.scalar_one_or_none()


async def require_owner(staff: Staff, db: AsyncSession) -> Shop:
    """Verify that this staff member is the shop owner. Returns the Shop."""
    result = await db.execute(select(Shop).where(Shop.id == staff.shop_id))
    shop = result.scalar_one_or_none()
    if shop is None or shop.owner_id != staff.user_id:
        raise HTTPException(status_code=403, detail="Only the shop owner can do this")
    return shop


async def get_staff_for_shop(staff_id: int, shop_id: int, db: AsyncSession) -> Staff:
    """Fetch a staff member and verify they belong to the given shop."""
    result = await db.execute(
        select(Staff).where(Staff.id == staff_id, Staff.shop_id == shop_id)
    )
    s = result.scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return s
