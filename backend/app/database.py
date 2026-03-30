from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.async_database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(
    engine, expire_on_commit=False, class_=AsyncSession
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    # Import all models so their tables are registered
    import app.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Live migration: widen telegram_id from INTEGER → BIGINT.
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text("ALTER TABLE users ALTER COLUMN telegram_id TYPE BIGINT")
            )
    except Exception:
        pass

    # Live migration: add reminder_sent column to bookings if missing.
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text("ALTER TABLE bookings ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT FALSE")
            )
    except Exception:
        pass

    # Live migration: add district column to shops if missing.
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE shops ADD COLUMN district VARCHAR(100)"))
    except Exception:
        pass

    # Live migration: add premium profile fields to shops if missing.
    for stmt in [
        "ALTER TABLE shops ADD COLUMN description TEXT",
        "ALTER TABLE shops ADD COLUMN has_photo BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE shops ADD COLUMN photo_mime VARCHAR(50)",
        "ALTER TABLE shops ADD COLUMN photo BYTEA",
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(stmt))
        except Exception:
            pass
