from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text, LargeBinary, UniqueConstraint
from sqlalchemy.orm import relationship, deferred
from sqlalchemy.sql import func

from app.database import Base


class Staff(Base):
    __tablename__ = "staff"
    __table_args__ = (
        UniqueConstraint("shop_id", "user_id", name="uq_staff_shop_user"),
    )

    id           = Column(Integer, primary_key=True, index=True)
    shop_id      = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    display_name = Column(String(255), nullable=True)
    phone        = Column(String(20), nullable=True)
    bio          = Column(Text, nullable=True)
    has_photo    = Column(Boolean, default=False)
    photo_mime   = Column(String(50), nullable=True)
    photo        = deferred(Column(LargeBinary, nullable=True))
    is_active    = Column(Boolean, nullable=False, default=True)
    is_approved  = Column(Boolean, nullable=False, default=False)  # requires admin approval
    is_rejected  = Column(Boolean, nullable=False, default=False)
    created_at   = Column(DateTime, server_default=func.now(), nullable=False)

    shop      = relationship("Shop", back_populates="staff_members")
    user      = relationship("User", back_populates="staff_records", foreign_keys=[user_id])
    schedules = relationship("WorkSchedule", back_populates="staff", cascade="all, delete-orphan")
    blocked_slots = relationship("BlockedSlot", back_populates="staff", cascade="all, delete-orphan")
    bookings  = relationship("Booking", back_populates="staff")
