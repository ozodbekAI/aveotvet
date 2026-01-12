from __future__ import annotations

from sqlalchemy import Boolean, Column, Integer, String, Text

from app.models.base import Base


class Tone(Base):
    """Global tone definitions.

    Stored separately from prompt_records so that admin can add/edit tones
    without editing JSON blobs.
    """

    __tablename__ = "tones"

    id = Column(Integer, primary_key=True)

    # stable identifier stored in ShopSettings.tone
    code = Column(String(64), nullable=False, unique=True, index=True)

    # UI label/hint
    label = Column(String(128), nullable=False)
    hint = Column(String(255), nullable=True)

    # instruction inserted into prompt templates (tone_map)
    instruction = Column(Text, nullable=True)

    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
