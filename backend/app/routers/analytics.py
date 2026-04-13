from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.booking import Booking
from app.models.review import Review
from app.services.staff_utils import get_my_staff_owner_fallback

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/my")
async def get_my_analytics(
    period: str = Query("month", pattern="^(week|month|all)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    staff = await get_my_staff_owner_fallback(current_user, db)
    if staff is None:
        return {
            "total": 0,
            "completed": 0,
            "cancelled": 0,
            "no_show": 0,
            "completion_rate": 0,
            "returning_customers": 0,
            "services": {"haircut": 0, "beard": 0, "combo": 0},
            "busiest_day": {"day": None, "counts": [0, 0, 0, 0, 0, 0, 0]},
            "avg_rating": None,
            "review_count": 0,
        }

    staff_id = staff.id

    # Date filter
    today = date.today()
    if period == "week":
        date_from = today - timedelta(days=6)
    elif period == "month":
        date_from = today - timedelta(days=29)
    else:
        date_from = None

    # ── Booking stats (single query) ─────────────────────────────────────────
    base_filter = [Booking.staff_id == staff_id]
    if date_from:
        base_filter.append(Booking.booking_date >= date_from)

    stats_result = await db.execute(
        select(
            func.count().label("total"),
            func.sum(case((Booking.status == "completed", 1), else_=0)).label("completed"),
            func.sum(case((Booking.status == "cancelled", 1), else_=0)).label("cancelled"),
            func.sum(case((Booking.status == "no_show", 1), else_=0)).label("no_show"),
        ).where(*base_filter)
    )
    stats = stats_result.one()
    total = stats.total or 0
    completed = stats.completed or 0
    cancelled = stats.cancelled or 0
    no_show = stats.no_show or 0

    denominator = completed + cancelled + no_show
    completion_rate = round(completed / denominator * 100) if denominator > 0 else 0

    # ── Services breakdown ────────────────────────────────────────────────────
    svc_result = await db.execute(
        select(Booking.service_type, func.count().label("cnt"))
        .where(*base_filter)
        .group_by(Booking.service_type)
    )
    services = {"haircut": 0, "beard": 0, "combo": 0}
    for row in svc_result:
        svc = row.service_type or "haircut"
        if svc in services:
            services[svc] = row.cnt

    # ── Busiest day (completed bookings, period-filtered) ─────────────────────
    # dow: 0=Sunday … 6=Saturday (PostgreSQL EXTRACT)
    day_filter = [Booking.staff_id == staff_id, Booking.status == "completed"]
    if date_from:
        day_filter.append(Booking.booking_date >= date_from)

    day_result = await db.execute(
        select(
            func.extract("dow", Booking.booking_date).label("dow"),
            func.count().label("cnt"),
        )
        .where(*day_filter)
        .group_by("dow")
    )
    # counts[0]=Mon … counts[6]=Sun  (map PG dow 1–6→0–5, 0→6)
    counts = [0] * 7
    busiest_day = None
    busiest_cnt = 0
    for row in day_result:
        pg_dow = int(row.dow)           # 0=Sun,1=Mon…6=Sat
        idx = (pg_dow - 1) % 7          # 0=Mon…6=Sun
        counts[idx] = row.cnt
        if row.cnt > busiest_cnt:
            busiest_cnt = row.cnt
            busiest_day = idx

    # ── Returning customers (all-time for this staff) ─────────────────────────
    returning_result = await db.execute(
        select(func.count()).select_from(
            select(Booking.customer_id)
            .where(
                Booking.staff_id == staff_id,
                Booking.customer_id.isnot(None),
            )
            .group_by(Booking.customer_id)
            .having(func.count() > 1)
            .subquery()
        )
    )
    returning_customers = returning_result.scalar() or 0

    # ── Rating ────────────────────────────────────────────────────────────────
    rating_result = await db.execute(
        select(
            func.avg(Review.rating).label("avg"),
            func.count(Review.id).label("cnt"),
        ).where(Review.staff_id == staff_id)
    )
    rating_row = rating_result.one()
    avg_rating = round(float(rating_row.avg), 1) if rating_row.avg else None
    review_count = rating_row.cnt or 0

    return {
        "total": total,
        "completed": completed,
        "cancelled": cancelled,
        "no_show": no_show,
        "completion_rate": completion_rate,
        "returning_customers": returning_customers,
        "services": services,
        "busiest_day": {"day": busiest_day, "counts": counts},
        "avg_rating": avg_rating,
        "review_count": review_count,
    }
