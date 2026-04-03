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

    # Live migration: add is_rejected + beard_duration to shops if missing.
    for stmt in [
        "ALTER TABLE shops ADD COLUMN is_rejected BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE shops ADD COLUMN beard_duration INTEGER",
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(stmt))
        except Exception:
            pass

    # Live migration: add service_type to bookings if missing.
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text("ALTER TABLE bookings ADD COLUMN service_type VARCHAR(20) NOT NULL DEFAULT 'haircut'")
            )
    except Exception:
        pass

    # Live migration: drop unique constraint on (shop_id, booking_date, time_slot) if it exists.
    # With service-type overlap logic, two bookings can start at different times on the same slot string.
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE bookings DROP CONSTRAINT IF EXISTS uq_shop_date_slot"))
    except Exception:
        pass

    # Live migration: add latitude/longitude to shops.
    for _col_sql in [
        "ALTER TABLE shops ADD COLUMN latitude FLOAT",
        "ALTER TABLE shops ADD COLUMN longitude FLOAT",
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(_col_sql))
        except Exception:
            pass

    # Live migration: create reviews table if missing.
    try:
        async with engine.begin() as conn:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS reviews (
                    id SERIAL PRIMARY KEY,
                    booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id),
                    shop_id INTEGER NOT NULL REFERENCES shops(id),
                    customer_id INTEGER REFERENCES users(id),
                    customer_name VARCHAR(100),
                    rating INTEGER NOT NULL,
                    comment TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """))
    except Exception:
        pass

    # ── Multi-staff migrations ─────────────────────────────────────────────────

    # 1. Create staff table.
    try:
        async with engine.begin() as conn:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS staff (
                    id SERIAL PRIMARY KEY,
                    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    display_name VARCHAR(255),
                    phone VARCHAR(20),
                    bio TEXT,
                    has_photo BOOLEAN NOT NULL DEFAULT FALSE,
                    photo_mime VARCHAR(50),
                    photo BYTEA,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
                    is_rejected BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_staff_shop_user UNIQUE (shop_id, user_id)
                )
            """))
    except Exception:
        pass

    # 2. Create staff_invites table.
    try:
        async with engine.begin() as conn:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS staff_invites (
                    id SERIAL PRIMARY KEY,
                    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                    token VARCHAR(64) NOT NULL UNIQUE,
                    created_by INTEGER NOT NULL REFERENCES users(id),
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    expires_at TIMESTAMP NOT NULL,
                    used_at TIMESTAMP,
                    used_by INTEGER REFERENCES users(id)
                )
            """))
    except Exception:
        pass

    # 3. Bootstrap: insert Staff row for every existing shop owner (idempotent).
    try:
        async with engine.begin() as conn:
            await conn.execute(text("""
                INSERT INTO staff (shop_id, user_id, display_name, is_active, is_approved)
                SELECT s.id, s.owner_id, u.full_name, TRUE, TRUE
                FROM shops s
                JOIN users u ON u.id = s.owner_id
                WHERE NOT EXISTS (
                    SELECT 1 FROM staff st WHERE st.shop_id = s.id AND st.user_id = s.owner_id
                )
            """))
    except Exception:
        pass

    # 4. Add staff_id to work_schedules.
    try:
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE work_schedules ADD COLUMN staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE"
            ))
    except Exception:
        pass

    # 5. Backfill work_schedules.staff_id using the owner's Staff row.
    try:
        async with engine.begin() as conn:
            await conn.execute(text("""
                UPDATE work_schedules ws
                SET staff_id = st.id
                FROM shops sh
                JOIN staff st ON st.shop_id = sh.id AND st.user_id = sh.owner_id
                WHERE ws.shop_id = sh.id AND ws.staff_id IS NULL
            """))
    except Exception:
        pass

    # 6a. Drop old unique constraint on work_schedules (shop_id, day_of_week).
    for _cname in ("uq_shop_day", "work_schedules_shop_id_day_of_week_key"):
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"ALTER TABLE work_schedules DROP CONSTRAINT IF EXISTS {_cname}"))
        except Exception:
            pass

    # 6b. Add new unique constraint (staff_id, day_of_week).
    try:
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE work_schedules ADD CONSTRAINT uq_staff_day UNIQUE (staff_id, day_of_week)"
            ))
    except Exception:
        pass

    # 7. Add staff_id to blocked_slots.
    try:
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE blocked_slots ADD COLUMN staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE"
            ))
    except Exception:
        pass

    # 8. Backfill blocked_slots.staff_id.
    try:
        async with engine.begin() as conn:
            await conn.execute(text("""
                UPDATE blocked_slots bs
                SET staff_id = st.id
                FROM shops sh
                JOIN staff st ON st.shop_id = sh.id AND st.user_id = sh.owner_id
                WHERE bs.shop_id = sh.id AND bs.staff_id IS NULL
            """))
    except Exception:
        pass

    # 8b. Drop old blocked_slots unique constraint and add new one scoped to staff_id.
    for _cname in ("uq_blocked_slot", "blocked_slots_shop_id_block_date_time_slot_key"):
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"ALTER TABLE blocked_slots DROP CONSTRAINT IF EXISTS {_cname}"))
        except Exception:
            pass

    try:
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE blocked_slots ADD CONSTRAINT uq_blocked_slot_staff UNIQUE (staff_id, block_date, time_slot)"
            ))
    except Exception:
        pass

    # 9. Add staff_id to bookings.
    try:
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE bookings ADD COLUMN staff_id INTEGER REFERENCES staff(id)"
            ))
    except Exception:
        pass

    # 10. Backfill bookings.staff_id.
    try:
        async with engine.begin() as conn:
            await conn.execute(text("""
                UPDATE bookings b
                SET staff_id = st.id
                FROM shops sh
                JOIN staff st ON st.shop_id = sh.id AND st.user_id = sh.owner_id
                WHERE b.shop_id = sh.id AND b.staff_id IS NULL
            """))
    except Exception:
        pass

    # 11. Add staff_id index to bookings for performance.
    try:
        async with engine.begin() as conn:
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_bookings_staff_id ON bookings(staff_id)"
            ))
    except Exception:
        pass

    # 12. Add staff_id index to work_schedules.
    try:
        async with engine.begin() as conn:
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_work_schedules_staff_id ON work_schedules(staff_id)"
            ))
    except Exception:
        pass

    # 13. Add staff_id index to blocked_slots.
    try:
        async with engine.begin() as conn:
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_blocked_slots_staff_id ON blocked_slots(staff_id)"
            ))
    except Exception:
        pass

    # 14. Add staff_id column to reviews if missing (for per-staff rating aggregation).
    try:
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE reviews ADD COLUMN staff_id INTEGER REFERENCES staff(id)"
            ))
    except Exception:
        pass

    # 15. Backfill reviews.staff_id from bookings.staff_id.
    try:
        async with engine.begin() as conn:
            await conn.execute(text("""
                UPDATE reviews r
                SET staff_id = b.staff_id
                FROM bookings b
                WHERE r.booking_id = b.id AND r.staff_id IS NULL AND b.staff_id IS NOT NULL
            """))
    except Exception:
        pass
