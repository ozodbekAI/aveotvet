from __future__ import annotations

import enum

class DraftStatus(str, enum.Enum):
    drafted = "drafted"     
    published = "published" 
    rejected = "rejected"   
    
    @classmethod
    def values(cls) -> list[str]:
        return [e.value for e in cls]


class JobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    done = "done"
    failed = "failed"


class JobType(str, enum.Enum):
    sync_shop = "sync_shop"
    sync_questions = "sync_questions"
    generate_draft = "generate_draft"
    publish_answer = "publish_answer"

    generate_question_draft = "generate_question_draft"
    publish_question_answer = "publish_question_answer"

    sync_chats = "sync_chats"
    sync_chat_events = "sync_chat_events"
    generate_chat_draft = "generate_chat_draft"
    send_chat_message = "send_chat_message"

    sync_product_cards = "sync_product_cards"

class UserRole(str, enum.Enum):
    """Platform-wide role."""
    super_admin = "super_admin"
    shop_owner = "shop_owner"
    user = "user"

    @classmethod
    def values(cls) -> list[str]:
        return [e.value for e in cls]


class ShopMemberRole(str, enum.Enum):
    """Role within a specific shop."""
    viewer = "viewer"
    operator = "operator"
    manager = "manager"
    owner = "owner"

    @classmethod
    def values(cls) -> list[str]:
        return [e.value for e in cls]


SHOP_ROLE_LEVEL: dict[str, int] = {
    ShopMemberRole.viewer.value: 1,
    ShopMemberRole.operator.value: 2,
    ShopMemberRole.manager.value: 3,
    ShopMemberRole.owner.value: 4,
}


def shop_role_at_least(role: str | None, min_role: str) -> bool:
    if not role:
        return False
    return SHOP_ROLE_LEVEL.get(role, 0) >= SHOP_ROLE_LEVEL.get(min_role, 999)
