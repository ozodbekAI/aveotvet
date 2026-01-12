# WB Otveto-like Backend (FastAPI + SQLAlchemy async + PostgreSQL)

This repository is a production-oriented backend for **Wildberries feedbacks & settings**:
- sync feedbacks from WB API (Feedbacks & Questions category)
- store feedbacks locally (for fast UI, analytics, buyer threads)
- generate reply drafts with OpenAI (ChatGPT) using Responses API
- (optional) auto-publish replies back to WB
- pinned feedbacks management (WB pins API)

## Tech stack
- FastAPI
- SQLAlchemy 2.x (async)
- asyncpg
- PostgreSQL
- Alembic
- httpx (WB API client)
- openai (AsyncOpenAI client)

## Quick start (local, without Docker)
1. Copy env:
   ```bash
   cp .env.example .env
   ```
2. Create & activate venv, install deps:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. Run migrations:
   ```bash
   alembic upgrade head
   ```
4. Run API:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
5. Run worker (separate terminal):
   ```bash
   python -m app.worker.main
   ```

API docs:
- Swagger: http://localhost:8000/docs
- ReDoc:   http://localhost:8000/redoc

## Services
- `api`    - FastAPI HTTP server
- `worker` - DB-outbox worker that runs sync/draft/publish jobs

## Important notes
- WB token must have **Feedbacks and Questions** permissions. Add token to `Authorization` header.
- WB rate limits exist. Worker uses a conservative internal limiter per shop.
- Auto-publish is optional and controlled by shop settings.

## Main env variables
See `.env.example`.



## Added in v2 (settings + buyers chat)
### Settings (per shop)
- `reply_mode`: manual | semi | auto
- `rating_mode_map`: per-rating workflow (manual/semi/auto)
- `blacklist_keywords`: force manual (no auto-publish)
- `templates`: optional per rating bucket (positive/neutral/negative)

### Buyers chat (WB Buyer Chat API)
Implements:
- chat sync (list + events pull)
- open chat (events from DB)
- ChatGPT suggestion for reply
- send message (multipart/form-data, optional files)

Endpoints:
- `POST /api/chats/{shop_id}/sync`
- `GET  /api/chats/{shop_id}`
- `GET  /api/chats/{shop_id}/{chat_id}/events`
- `POST /api/chats/{shop_id}/{chat_id}/draft`
- `POST /api/chats/{shop_id}/{chat_id}/send`
- `GET  /api/chats/{shop_id}/download/{download_id}`

## Added in v3 (Questions + signature pool)
### Questions (WB product questions)
Implements:
- sync questions into DB
- draft answer (ChatGPT)
- publish/edit answer back to WB
- reject question

Endpoints:
- `POST /api/questions/{shop_id}/sync`
- `GET  /api/questions/{shop_id}`
- `GET  /api/questions/{shop_id}/{wb_id}`
- `POST /api/questions/{shop_id}/{wb_id}/view`
- `POST /api/questions/{shop_id}/{wb_id}/draft`
- `POST /api/questions/{shop_id}/{wb_id}/publish`
- `POST /api/questions/{shop_id}/{wb_id}/reject`

### Extra settings (per shop)
- `signatures`: list of signatures (drafting picks one)
- `questions_reply_mode`: manual | semi | auto
- `questions_auto_draft`: enqueue drafts after questions sync
- `questions_auto_publish`: if reply_mode=auto, auto publish after draft



## Password hashing
This build uses `passlib` scheme `pbkdf2_sha256` to avoid bcrypt 72-byte password limitations.
