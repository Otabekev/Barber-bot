from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(Integer, unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    language = Column(String(10), default="uz")
    is_admin = Column(Boolean, default=False)

    shops = relationship("Shop", back_populates="owner", cascade="all, delete-orphan")
