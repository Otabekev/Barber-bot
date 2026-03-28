"""
One-time script: promote a user to admin by Telegram ID.
If the user row does not exist yet it creates it directly.

Run from inside the Railway backend service:
    railway run --service <your-backend-service-name> python scripts/make_admin.py
"""
import asyncio
import os
import sys

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.user import User  # noqa: F401 — registers model with Base.metadata

TELEGRAM_ID = 1326459825


async def main() -> None:
    # ── Diagnostics ────────────────────────────────────────────────────────
    raw_url = os.environ.get("DATABASE_URL", "(not set)")
    async_url = settings.async_database_url

    # Mask password in printed URL for safety
    def mask(url: str) -> str:
        if "@" in url:
            scheme, rest = url.split("://", 1)
            creds, host = rest.split("@", 1)
            user_part = creds.split(":")[0]
            return f"{scheme}://{user_part}:***@{host}"
        return url

    print(f"DATABASE_URL (raw) : {mask(raw_url)}")
    print(f"async_database_url : {mask(async_url)}")
    print()

    engine = create_async_engine(async_url, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with Session() as session:
        # ── Show all users so we can spot telegram_id mismatches ───────────
        all_users = (await session.execute(select(User))).scalars().all()
        print(f"Total users in DB: {len(all_users)}")
        for u in all_users:
            print(f"  id={u.id}  telegram_id={u.telegram_id}  name={u.full_name!r}  admin={u.is_admin}")
        print()

        # ── Find or create target user ──────────────────────────────────────
        result = await session.execute(
            select(User).where(User.telegram_id == TELEGRAM_ID)
        )
        user = result.scalar_one_or_none()

        if user is None:
            print(f"No row for telegram_id={TELEGRAM_ID} — creating admin user directly.")
            user = User(
                telegram_id=TELEGRAM_ID,
                full_name="Admin",
                language="uz",
                is_admin=True,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            print(f"SUCCESS: Created admin user (id={user.id}).")
            print("When you next open the Mini App from Telegram, your existing row will be")
            print("found and updated with your real name/language — is_admin stays True.")
        elif user.is_admin:
            print(f"Already admin: {user.full_name!r} (id={user.id}) — nothing to do.")
        else:
            user.is_admin = True
            await session.commit()
            print(f"SUCCESS: {user.full_name!r} (telegram_id={user.telegram_id}, id={user.id}) is now admin.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
