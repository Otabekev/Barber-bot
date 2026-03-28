"""
Background scheduler: sends booking reminders 5 hours before appointment.
Runs every 10 minutes. Marks reminder_sent=True to prevent double-sending.
"""
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.booking import Booking
from app.models.shop import Shop
from app.models.user import User
from app.services.notifications import send_reminder

logger = logging.getLogger(__name__)

_scheduler = AsyncIOScheduler(timezone="Asia/Tashkent")


async def _run_reminders() -> None:
    engine = create_async_engine(settings.async_database_url, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    now = datetime.now(timezone.utc)
    window_start = now + timedelta(hours=4, minutes=50)
    window_end   = now + timedelta(hours=5, minutes=10)

    async with Session() as session:
        result = await session.execute(
            select(Booking).where(
                Booking.status.in_(["pending", "confirmed"]),
                Booking.reminder_sent == False,  # noqa: E712
            )
        )
        bookings = result.scalars().all()

        for booking in bookings:
            # Build a timezone-aware datetime from booking_date + time_slot
            try:
                dt_naive = datetime.strptime(
                    f"{booking.booking_date} {booking.time_slot}", "%Y-%m-%d %H:%M"
                )
                # Tashkent is UTC+5; store as UTC for comparison
                dt_utc = dt_naive.replace(tzinfo=timezone.utc) - timedelta(hours=5)
            except ValueError:
                continue

            if not (window_start <= dt_utc <= window_end):
                continue

            # Fetch shop + customer info
            shop_result = await session.execute(
                select(Shop).where(Shop.id == booking.shop_id)
            )
            shop = shop_result.scalar_one_or_none()
            if not shop or not booking.customer_id:
                continue

            customer_result = await session.execute(
                select(User).where(User.id == booking.customer_id)
            )
            customer = customer_result.scalar_one_or_none()
            if not customer:
                continue

            # Mark sent before firing — avoids double-send if the task is slow
            booking.reminder_sent = True
            await session.commit()

            await send_reminder(
                customer_telegram_id=customer.telegram_id,
                booking_id=booking.id,
                shop_name=shop.name,
                shop_address=shop.address,
                time_slot=booking.time_slot,
                customer_language=customer.language,
            )
            logger.info(
                "Reminder sent: booking_id=%d customer_telegram_id=%d",
                booking.id, customer.telegram_id,
            )

    await engine.dispose()


def start_scheduler() -> None:
    _scheduler.add_job(_run_reminders, "interval", minutes=10, id="reminders")
    _scheduler.start()
    logger.info("Reminder scheduler started (every 10 min)")


def stop_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Reminder scheduler stopped")
