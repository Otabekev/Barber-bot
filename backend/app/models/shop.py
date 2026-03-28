from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship

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

    owner = relationship("User", back_populates="shops")
    schedules = relationship(
        "WorkSchedule", back_populates="shop", cascade="all, delete-orphan"
    )
    bookings = relationship(
        "Booking", back_populates="shop", cascade="all, delete-orphan"
    )
    blocked_slots = relationship(
        "BlockedSlot", back_populates="shop", cascade="all, delete-orphan"
    )
