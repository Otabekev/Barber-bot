import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.auth import validate_init_data, create_access_token
from app.models.user import User
from app.schemas.user import UserOut
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


class InitDataPayload(BaseModel):
    init_data: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


@router.post("/telegram", response_model=AuthResponse)
async def telegram_auth(
    payload: InitDataPayload,
    db: AsyncSession = Depends(get_db),
):
    """Validate Telegram initData and return a JWT access token."""
    logger.info(
        "POST /auth/telegram — initData length=%d",
        len(payload.init_data) if payload.init_data else 0,
    )

    if not payload.init_data:
        logger.error("Empty init_data received")
        raise HTTPException(status_code=400, detail="init_data is required and cannot be empty")

    # Raises 401 if HMAC fails
    user_data = validate_init_data(payload.init_data)

    telegram_id: int = user_data.get("id")
    if not telegram_id:
        logger.error("No 'id' field in user_data: %s", user_data)
        raise HTTPException(status_code=400, detail="No user ID in initData")

    first = user_data.get("first_name", "")
    last = user_data.get("last_name", "")
    full_name = f"{first} {last}".strip() or f"User{telegram_id}"
    language = user_data.get("language_code", "en")

    logger.info("Upserting user telegram_id=%d name='%s'", telegram_id, full_name)

    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()

    if user is None:
        logger.info("New user — creating record")
        user = User(telegram_id=telegram_id, full_name=full_name, language=language)
        db.add(user)
    else:
        logger.info("Existing user — updating name/language")
        user.full_name = full_name
        user.language = language

    await db.commit()
    await db.refresh(user)

    token = create_access_token(telegram_id)
    logger.info("Auth complete for telegram_id=%d", telegram_id)
    return AuthResponse(access_token=token, user=UserOut.model_validate(user))


# ── Dev-only login ────────────────────────────────────────────────────────────

DEV_USER_TELEGRAM_ID = 1  # fake telegram_id used in browser dev mode


@router.post("/dev-login", response_model=AuthResponse)
async def dev_login(db: AsyncSession = Depends(get_db)):
    """
    Issue a real JWT for a local dev user.
    Only available when DEV_MODE=true in backend .env.
    NEVER enable this in production.
    """
    if not settings.DEV_MODE:
        raise HTTPException(
            status_code=403,
            detail="dev-login is disabled. Set DEV_MODE=true in backend .env to enable it (local dev only).",
        )

    logger.warning("DEV LOGIN used — this endpoint must be disabled in production")

    result = await db.execute(select(User).where(User.telegram_id == DEV_USER_TELEGRAM_ID))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(telegram_id=DEV_USER_TELEGRAM_ID, full_name="Dev User", language="en")
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info("Created dev user (telegram_id=%d)", DEV_USER_TELEGRAM_ID)

    token = create_access_token(DEV_USER_TELEGRAM_ID)
    return AuthResponse(access_token=token, user=UserOut.model_validate(user))
