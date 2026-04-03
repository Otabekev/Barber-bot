from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class StaffInvite(Base):
    __tablename__ = "staff_invites"

    id         = Column(Integer, primary_key=True, index=True)
    shop_id    = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    token      = Column(String(64), unique=True, nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at    = Column(DateTime, nullable=True)
    used_by    = Column(Integer, ForeignKey("users.id"), nullable=True)

    shop = relationship("Shop")
