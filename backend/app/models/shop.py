from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, LargeBinary, Float
from sqlalchemy.orm import relationship, deferred

from app.database import Base


class Shop(Base):
    __tablename__ = "shops"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    region = Column(String(100), nullable=False, default="Toshkent shahri")
    city = Column(String(255), nullable=False)
    address = Column(String(500), nullable=False)
    phone = Column(String(20), nullable=False)
    slot_duration = Column(Integer, default=30)  # minutes
    is_approved = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    is_rejected = Column(Boolean, default=False, nullable=False)
    beard_duration = Column(Integer, nullable=True)  # None = beard not offered; 5/10/15 minutes

    district = Column(String(100), nullable=True)

    # Premium profile fields
    description = Column(Text, nullable=True)
    has_photo = Column(Boolean, default=False)
    photo_mime = Column(String(50), nullable=True)
    # Deferred: photo bytes are NOT loaded in regular shop list queries
    photo = deferred(Column(LargeBinary, nullable=True))

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    owner         = relationship("User", back_populates="shops")
    staff_members = relationship("Staff", back_populates="shop", cascade="all, delete-orphan")
    schedules = relationship(
        "WorkSchedule", back_populates="shop", cascade="all, delete-orphan"
    )
    bookings = relationship(
        "Booking", back_populates="shop", cascade="all, delete-orphan"
    )
    blocked_slots = relationship(
        "BlockedSlot", back_populates="shop", cascade="all, delete-orphan"
    )
