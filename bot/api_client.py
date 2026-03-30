"""HTTP client for calling the backend bot-specific endpoints."""
import httpx
from typing import List, Optional

from bot.config import Config


class BackendClient:
    def __init__(self, config: Config):
        self._base = config.BACKEND_URL.rstrip("/")
        self._headers = {"X-Bot-Secret": config.BOT_SECRET}

    async def set_language(self, telegram_id: int, language: str, full_name: str = "") -> bool:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                f"{self._base}/api/bot/set-language",
                json={"telegram_id": telegram_id, "language": language, "full_name": full_name},
                headers=self._headers,
            )
            return resp.status_code == 200

    async def get_shops(self, region: str) -> List[dict]:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{self._base}/api/bot/shops",
                params={"region": region},
                headers=self._headers,
            )
            if resp.status_code == 200:
                return resp.json()
            return []

    async def get_barber_today(self, telegram_id: int) -> Optional[dict]:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{self._base}/api/bot/barber-today",
                params={"telegram_id": telegram_id},
                headers=self._headers,
            )
            if resp.status_code == 200:
                return resp.json()
            return None

    async def get_shop_photo(self, shop_id: int) -> bytes | None:
        """Fetch photo bytes for a shop from the public /shops/{id}/photo endpoint."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{self._base}/api/shops/{shop_id}/photo")
                if resp.status_code == 200:
                    return resp.content
        except Exception:
            pass
        return None

    async def cancel_from_reminder(self, booking_id: int, telegram_id: int) -> dict:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                f"{self._base}/api/bot/cancel-from-reminder",
                json={"booking_id": booking_id, "telegram_id": telegram_id},
                headers=self._headers,
            )
            if resp.status_code == 200:
                return resp.json()
            return {"ok": False}
