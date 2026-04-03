from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class WorkSchedule(Base):
    __tablename__ = "work_schedules"
    __table_args__ = (
        UniqueConstraint("staff_id", "day_of_week", name="uq_staff_day"),
    )

    id          = Column(Integer, primary_key=True, index=True)
    shop_id     = Column(Integer, ForeignKey("shops.id"), nullable=False, index=True)
    staff_id    = Column(Integer, ForeignKey("staff.id", ondelete="CASCADE"), nullable=True, index=True)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday … 6=Sunday
    open_time   = Column(String(5), nullable=False)   # "HH:MM"
    close_time  = Column(String(5), nullable=False)   # "HH:MM"
    is_working  = Column(Boolean, default=True)

    shop  = relationship("Shop", back_populates="schedules")
    staff = relationship("Staff", back_populates="schedules")
