from __future__ import annotations

import enum

class DraftStatus(str, enum.Enum):
    """Draft status."""
    drafted = "drafted"      # Auto-generated, waiting for review
    published = "published"  # Approved and published to marketplace
    rejected = "rejected"    # Rejected by user, won't be published
    
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
