import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import unquote, parse_qsl

from fastapi import HTTPException
from jose import jwt, JWTError

from app.config import settings

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24


def validate_init_data(init_data: str) -> dict:
    """
    Validate Telegram WebApp initData using HMAC-SHA256.
    Returns the parsed user dict on success, raises HTTPException on failure.

    Algorithm per Telegram docs:
      secret_key = HMAC_SHA256(key="WebAppData", data=bot_token)
      hash        = HMAC_SHA256(key=secret_key,  data=data_check_string)
    """
    logger.info("validate_init_data called — initData length=%d", len(init_data))

    if not init_data:
        logger.error("initData is empty")
        raise HTTPException(status_code=401, detail="initData is empty")

    parsed = dict(parse_qsl(unquote(init_data), keep_blank_values=True))
    logger.debug("Parsed initData keys: %s", list(parsed.keys()))

    hash_val = parsed.pop("hash", None)
    if not hash_val:
        logger.error("'hash' field missing from initData")
        raise HTTPException(status_code=401, detail="Missing hash in initData")

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(parsed.items())
    )
    logger.debug("data_check_string:\n%s", data_check_string)

    # Step 1: derive secret key from bot token
    secret_key = hmac.new(
        b"WebAppData",
        settings.BOT_TOKEN.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    # Step 2: compute expected hash
    computed_hash = hmac.new(
        secret_key,
        data_check_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    logger.debug("Expected hash: %s", computed_hash)
    logger.debug("Received hash: %s", hash_val)

    if not hmac.compare_digest(computed_hash, hash_val):
        logger.error(
            "HMAC mismatch — initData is invalid or BOT_TOKEN is wrong. "
            "Make sure BOT_TOKEN in .env matches the bot that opened this Mini App."
        )
        raise HTTPException(
            status_code=401,
            detail="Invalid initData signature — check that BOT_TOKEN matches your bot",
        )

    user_data = json.loads(parsed.get("user", "{}"))
    logger.info("initData validated successfully — telegram_id=%s", user_data.get("id"))
    return user_data


def create_access_token(telegram_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": str(telegram_id), "exp": expire}
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)
    logger.info("JWT created for telegram_id=%d, expires in %dh", telegram_id, ACCESS_TOKEN_EXPIRE_HOURS)
    return token


def decode_access_token(token: str) -> int:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        telegram_id = payload.get("sub")
        if telegram_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return int(telegram_id)
    except JWTError as e:
        logger.warning("JWT decode failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid or expired token")
