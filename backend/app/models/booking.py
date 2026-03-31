from sqlalchemy import Column, Integer, String, ForeignKey, Date, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = ()

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False, index=True)
    booking_date = Column(Date, nullable=False, index=True)
    time_slot = Column(String(5), nullable=False)   # "HH:MM"
    status = Column(String(20), default="pending")  # pending | confirmed | cancelled | completed
    customer_name = Column(String(255), nullable=False)
    customer_phone = Column(String(20), nullable=False)
    reminder_sent = Column(Boolean, default=False, nullable=False)
    service_type = Column(String(20), nullable=False, default="haircut")  # haircut | beard | combo

    customer = relationship("User", foreign_keys=[customer_id])
    shop = relationship("Shop", back_populates="bookings")
