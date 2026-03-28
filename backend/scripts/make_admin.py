"""
One-time script: promote a user to admin by Telegram ID.

Run from inside the Railway backend service:
    railway run --service <your-backend-service-name> python scripts/make_admin.py
"""
import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.user import User  # noqa: F401 — registers model with metadata

TELEGRAM_ID = 1326459825


async def main() -> None:
    engine = create_async_engine(settings.async_database_url, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with Session() as session:
        result = await session.execute(
            select(User).where(User.telegram_id == TELEGRAM_ID)
        )
        user = result.scalar_one_or_none()

        if user is None:
            print(f"ERROR: No user found with telegram_id={TELEGRAM_ID}")
            print("Open the Mini App at least once first so your account is created.")
            await engine.dispose()
            sys.exit(1)

        if user.is_admin:
            print(f"Already admin: {user.full_name!r} (id={user.id})")
            await engine.dispose()
            sys.exit(0)

        user.is_admin = True
        await session.commit()
        print(f"SUCCESS: {user.full_name!r} (telegram_id={user.telegram_id}, id={user.id}) is now admin.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
