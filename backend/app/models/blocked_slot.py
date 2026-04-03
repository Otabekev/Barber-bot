from sqlalchemy import Column, Integer, String, ForeignKey, Date, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class BlockedSlot(Base):
    __tablename__ = "blocked_slots"
    __table_args__ = (
        UniqueConstraint("staff_id", "block_date", "time_slot", name="uq_blocked_slot_staff"),
    )

    id          = Column(Integer, primary_key=True, index=True)
    shop_id     = Column(Integer, ForeignKey("shops.id"), nullable=False, index=True)
    staff_id    = Column(Integer, ForeignKey("staff.id", ondelete="CASCADE"), nullable=True, index=True)
    block_date  = Column(Date, nullable=False, index=True)
    time_slot   = Column(String(5), nullable=False)  # "HH:MM"

    shop  = relationship("Shop", back_populates="blocked_slots")
    staff = relationship("Staff", back_populates="blocked_slots")
