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

    # Live migration: widen telegram_id from INTEGER → BIGINT so users with
    # IDs above 2 147 483 647 (all accounts created after ~2019) can auth.
    # Safe to run repeatedly — PostgreSQL is a no-op if already BIGINT;
    # SQLite doesn't support ALTER TYPE so the except swallows that silently.
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text("ALTER TABLE users ALTER COLUMN telegram_id TYPE BIGINT")
            )
    except Exception:
        pass
