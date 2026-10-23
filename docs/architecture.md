# architecture.md — System Architecture

## 1. Overall Architecture
Modular monolith backend (FastAPI) + Next.js frontend + Neon Postgres. Chosen for speed of delivery, low latency, easy ops; modules are separable later.

```
Browser (Next.js, WebCrypto E2EE)
   │ HTTPS (REST polling + writes)
   ▼
FastAPI (ASGI / uvicorn)
   ├─ REST routers  ├─ Polling sync  ├─ Purge scheduler
   ▼
Neon Postgres (pooled, TLS)   [ciphertext only]
```

## 2. Application Flow
1. Admin identity is bootstrapped in Clerk and protected with MFA.
2. User signs up directly with Clerk and verifies their email; the API provisions a pending account.
3. Admin approves the registration; the API grants the Clerk user role and activates the local account.
4. Approved user signs in → browser generates ECDH keypair → public key registered.
5. Conversation created → client generates AES-256 key → wraps for each member.
6. Messages: encrypt (AES-GCM) → authenticated REST write → Postgres → clients poll history and decrypt.
7. Purge job deletes expired rows every 60 s.

## 3. Frontend Architecture
- Next.js 15 (App Router), TypeScript, Tailwind CSS.
- State: Zustand (UI/session), TanStack Query (REST cache).
- Crypto: native **WebCrypto** (ECDH P-256, HKDF-SHA256, AES-256-GCM); private key non-extractable, stored in IndexedDB.
- Database sync: poll conversation metadata every 10 seconds and the open message history every 3 seconds.
- Rendering: server components for shells; client components for chat.

## 4. Backend Architecture
```
app/
 ├─ main.py            # app factory, middleware, lifespan (scheduler)
 ├─ core/              # config, rate_limit, logging
 ├─ api/v1/            # admin, users, conversations, webhooks
 ├─ services/          # user_service, chat_service, purge_service
 ├─ repositories/      # SQLAlchemy queries only
 ├─ models/            # ORM models
 ├─ schemas/           # Pydantic v2
 └─ cli/               # bootstrap_admin.py
```
Layering: router → service → repository. No SQL in routers.

## 5. Database Architecture
Neon Postgres. Pooled connection string for app (asyncpg), direct string for Alembic migrations. Details in database.md.

## 6. API Architecture
REST `/api/v1/*` JSON for reads, writes, and database polling. Pydantic validation on every input. Cursor pagination for history.

## 7. Authentication Flow
```
User signup: Clerk → verified session → GET /users/me → local account pending
   → 403 APPROVAL_PENDING until admin approval
Admin approval: POST /admin/users/{id}/approve
   → set Clerk public_metadata.role=user + local status=active + audit
Admin login: Clerk session JWT; server requires role=admin and configured MFA
```

## 8. Authorization / Roles
Dependency `require_role("admin")`; membership checks (`is_member(conversation, user)`) on every conversation read/write. Broadcast channels: only `sender` role may post.

## 9. Data Flow (E2EE message)
```
Sender: plaintext → AES-GCM(convKey, nonce) → {ciphertext, nonce, key_version}
   → HTTPS REST → Server: validate membership and size → INSERT (expires_at=now+10h)
   → Recipient polls REST history, then AES-GCM decrypts with convKey → render
```
Server never holds plaintext or conversation keys in the clear.

## 10. External Services
Neon (Postgres). Optional: Redis/Upstash (rate limiting), Sentry (errors, scrubbed).

## 11. Folder Structure
```
vaultchat/
 ├─ docs/                (these .md files)
 ├─ frontend/            (Next.js)
 └─ backend/             (FastAPI)
```
Frontend:
```
frontend/src/
 ├─ app/(auth)/login, admin/login
 ├─ app/(app)/ page.tsx, chats/[id], groups/new, settings
 ├─ app/admin/ users, audit, security
 ├─ components/ ui/ (GlassCard, Sidebar, Stat…), chat/, admin/
 ├─ lib/ crypto/, api/, utils
 ├─ stores/  hooks/  types/
```

## 12. Route Structure
See PRD §9. Route groups: `(auth)`, `(app)` (user guard), `admin` (admin guard via middleware + server check).

## 13. API Endpoint Structure
| Method | Path | Role |
|---|---|---|
| GET | /admin/users | admin |
| POST | /admin/users/{id}/approve | admin |
| POST | /admin/users/{id}/reset-key | admin |
| PATCH | /admin/users/{id} (disable/enable) | admin |
| DELETE | /admin/users/{id} | admin |
| GET | /admin/audit | admin |
| GET | /users | user (directory: id, display name, public key) |
| POST | /conversations | user |
| GET | /conversations | user |
| POST | /conversations/{id}/members · DELETE …/{uid} | owner |
| GET | /conversations/{id}/messages?cursor= | member |

## 14. Key Technical Decisions
| Decision | Choice | Why |
|---|---|---|
| Live sync | Authenticated REST polling against Postgres | Simple deployment and durable cross-instance state |
| Crypto | WebCrypto ECDH + AES-GCM | Native, fast, non-extractable keys |
| One key per conversation | Wrapped per member | Same model for 1:1, group, broadcast |
| Retention | `expires_at` column + purge job + read filter | Correct even if job lags |
| Authentication | Clerk-managed session JWT + API-side approval gate | Managed credentials and sessions; pending users have no application access |
