from __future__ import annotations

from sqlalchemy import Boolean, Column, Integer, String, Text

from app.models.base import Base


class Tone(Base):

    __tablename__ = "tones"

    id = Column(Integer, primary_key=True)

    code = Column(String(64), nullable=False, unique=True, index=True)

    label = Column(String(128), nullable=False)
    hint = Column(String(255), nullable=True)

    instruction = Column(Text, nullable=True)

    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
