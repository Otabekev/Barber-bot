"""Staff management router: invites, team view, profile management."""
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import undefer, selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.staff import Staff
from app.models.staff_invite import StaffInvite
from app.schemas.staff import StaffOut, StaffUpdate, InviteOut, InviteInfo, StaffUserInfo
from app.services.staff_utils import get_my_staff, get_my_staff_optional, get_my_staff_owner_fallback, require_owner, get_staff_for_shop

router = APIRouter(prefix="/staff", tags=["staff"])

INVITE_EXPIRE_HOURS = 48


# ─── helpers ──────────────────────────────────────────────────────────────────

async def _staff_with_rating(staff: Staff, db: AsyncSession) -> StaffOut:
    """Build a StaffOut with avg_rating + review_count populated."""
    from app.models.review import Review
    from app.models.booking import Booking as BookingModel
    agg = await db.execute(
        select(
            func.avg(Review.rating).label("avg"),
            func.count(Review.id).label("cnt"),
        ).where(Review.staff_id == staff.id)
    )
    row = agg.one()
    out = StaffOut.model_validate(staff)
    out.avg_rating = round(float(row.avg), 1) if row.avg else None
    out.review_count = row.cnt or 0
    return out


async def _load_user(staff: Staff, db: AsyncSession) -> Staff:
    """Eagerly load the user relationship if not already loaded."""
    if staff.user is None:
        result = await db.execute(
            select(Staff).options(selectinload(Staff.user)).where(Staff.id == staff.id)
        )
        staff = result.scalar_one()
    return staff


async def _get_shop_by_owner(user: User, db: AsyncSession) -> Shop:
    result = await db.execute(select(Shop).where(Shop.owner_id == user.id))
    shop = result.scalar_one_or_none()
    if shop is None:
        raise HTTPException(status_code=404, detail="You don't have a shop")
    return shop


# ─── current user's staff record ──────────────────────────────────────────────

@router.get("/my", response_model=StaffOut | None)
async def get_my_staff_record(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's staff record (or null if none). Auto-bootstraps for shop owners."""
    staff = await get_my_staff_owner_fallback(current_user, db)
    if staff is None:
        return None
    staff = await _load_user(staff, db)
    out = await _staff_with_rating(staff, db)

    # Determine is_owner
    shop_result = await db.execute(select(Shop).where(Shop.id == staff.shop_id))
    shop = shop_result.scalar_one_or_none()
    out.is_owner = (shop is not None and shop.owner_id == current_user.id)
    return out


# ─── owner: team management ───────────────────────────────────────────────────

@router.get("/shop", response_model=list[StaffOut])
async def get_shop_staff(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Owner only: list all staff for their shop."""
    shop = await _get_shop_by_owner(current_user, db)
    result = await db.execute(
        select(Staff)
        .options(selectinload(Staff.user))
        .where(Staff.shop_id == shop.id)
        .order_by(Staff.created_at)
    )
    staff_list = result.scalars().all()

    from app.models.review import Review
    outputs = []
    for s in staff_list:
        agg = await db.execute(
            select(
                func.avg(Review.rating).label("avg"),
                func.count(Review.id).label("cnt"),
            ).where(Review.staff_id == s.id)
        )
        row = agg.one()
        out = StaffOut.model_validate(s)
        out.avg_rating = round(float(row.avg), 1) if row.avg else None
        out.review_count = row.cnt or 0
        out.is_owner = (s.user_id == shop.owner_id)
        outputs.append(out)
    return outputs


@router.post("/invite", response_model=InviteOut)
async def create_invite(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Owner only: generate a one-time invite link."""
    shop = await _get_shop_by_owner(current_user, db)
    if not shop.is_approved:
        raise HTTPException(status_code=403, detail="Shop must be approved before inviting staff")

    token = secrets.token_hex(32)  # 64 hex chars
    expires = datetime.utcnow() + timedelta(hours=INVITE_EXPIRE_HOURS)
    invite = StaffInvite(
        shop_id=shop.id,
        token=token,
        created_by=current_user.id,
        expires_at=expires,
    )
    db.add(invite)
    await db.commit()

    from app.config import settings
    deep_link = f"https://t.me/{settings.BOT_USERNAME}?start=join_{token}"
    return InviteOut(
        token=token,
        deep_link=deep_link,
        expires_at=expires,
        shop_name=shop.name,
    )


@router.delete("/{staff_id}", status_code=204)
async def remove_staff(
    staff_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Owner only: soft-delete a staff member (set is_active=False)."""
    shop = await _get_shop_by_owner(current_user, db)
    s = await get_staff_for_shop(staff_id, shop.id, db)
    if s.user_id == shop.owner_id:
        raise HTTPException(status_code=400, detail="Cannot remove the shop owner")
    s.is_active = False
    await db.commit()


# ─── invite flow (public) ──────────────────────────────────────────────────────

@router.get("/invite/{token}", response_model=InviteInfo)
async def get_invite_info(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Public: return invite metadata for display before accepting."""
    result = await db.execute(select(StaffInvite).where(StaffInvite.token == token))
    invite = result.scalar_one_or_none()
    if invite is None:
        raise HTTPException(status_code=404, detail="Invite not found")

    shop_result = await db.execute(select(Shop).where(Shop.id == invite.shop_id))
    shop = shop_result.scalar_one_or_none()

    now = datetime.utcnow()
    return InviteInfo(
        shop_name=shop.name if shop else "",
        shop_city=shop.district or shop.region if shop else "",
        expires_at=invite.expires_at,
        is_expired=now > invite.expires_at,
        is_used=invite.used_at is not None,
    )


@router.post("/invite/{token}/accept", response_model=StaffOut)
async def accept_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Authenticated user accepts an invite — creates a pending Staff row."""
    result = await db.execute(select(StaffInvite).where(StaffInvite.token == token))
    invite = result.scalar_one_or_none()
    if invite is None:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.used_at is not None:
        raise HTTPException(status_code=400, detail="Invite already used")
    if datetime.utcnow() > invite.expires_at:
        raise HTTPException(status_code=400, detail="Invite has expired")

    # Check if user already has a staff record for this shop
    existing = await db.execute(
        select(Staff).where(Staff.shop_id == invite.shop_id, Staff.user_id == current_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You are already a member of this shop")

    staff = Staff(
        shop_id=invite.shop_id,
        user_id=current_user.id,
        display_name=current_user.full_name,
        is_active=True,
        is_approved=False,  # awaits admin approval
        is_rejected=False,
    )
    db.add(staff)

    invite.used_at = datetime.utcnow()
    invite.used_by = current_user.id
    await db.commit()
    await db.refresh(staff)

    # Notify admin (non-blocking)
    try:
        from app.services.notifications import notify_admin_staff_pending
        await notify_admin_staff_pending(
            staff_name=current_user.full_name,
            shop_id=invite.shop_id,
            db=db,
        )
    except Exception:
        pass

    out = StaffOut.model_validate(staff)
    out.is_owner = False
    return out


# ─── staff: own profile management ────────────────────────────────────────────

@router.patch("/my/profile", response_model=StaffOut)
async def update_my_profile(
    data: StaffUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Any active staff member can update their own display_name, phone, bio."""
    staff = await get_my_staff(current_user, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(staff, field, value)
    await db.commit()
    await db.refresh(staff)
    staff = await _load_user(staff, db)
    return await _staff_with_rating(staff, db)


@router.post("/my/photo", status_code=204)
async def upload_my_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload / replace the staff member's profile photo."""
    staff = await get_my_staff(current_user, db)
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Unsupported image format")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5 MB)")
    staff.photo = data
    staff.photo_mime = file.content_type
    staff.has_photo = True
    await db.commit()


@router.get("/photo/{staff_id}")
async def get_staff_photo(
    staff_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Public: serve staff profile photo."""
    result = await db.execute(
        select(Staff).options(undefer(Staff.photo)).where(Staff.id == staff_id)
    )
    staff = result.scalar_one_or_none()
    if staff is None or not staff.has_photo or staff.photo is None:
        raise HTTPException(status_code=404, detail="No photo")
    return Response(content=staff.photo, media_type=staff.photo_mime or "image/jpeg")


# ─── owner: manage another staff member's profile ─────────────────────────────

@router.patch("/{staff_id}/approve", status_code=204)
async def owner_note_staff(
    staff_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Placeholder — actual approval is done by admin panel."""
    raise HTTPException(status_code=403, detail="Staff approval is handled by admin")
