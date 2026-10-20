# VaultChat Backend

Admin-approved, end-to-end-encrypted chat API. **FastAPI + native WebSockets + Neon Postgres + Clerk authentication.**
The server stores **ciphertext and wrapped keys only**; messages hard-expire 10 h after sending.

```
app/
 ├─ main.py / asgi.py     app factory, lifespan (Container, purge scheduler, hub)
 ├─ integrations/clerk.py Clerk session-token verification (JWKS), Backend API client, webhook signatures
 ├─ core/                 config, errors, rate_limit, middleware, logging
 ├─ db/  models/          async SQLAlchemy 2, ORM models
 ├─ repositories/         SQL only
 ├─ services/             identity (Clerk→DB sync), admin, chat, webhook, purge
 ├─ schemas/              Pydantic v2, camelCase on the wire, strict input
 ├─ api/v1/               auth(ws-ticket) · users · conversations · admin · webhooks
 ├─ ws/                   hub (fan-out, Redis bus), /ws endpoint
 └─ cli/bootstrap_admin.py
alembic/  sql/roles.sql  tests/{unit,integration}  Dockerfile  docker-compose.yml
```

## How authentication works now
```
Browser (Clerk SDK) ──session JWT (Authorization: Bearer)──► API
                                        │ verify RS256 via Clerk JWKS (iss, exp, nbf, azp, sts)
                                        ▼
                          IdentityService: users row ⇄ Clerk (role, ban) ── cached 5 min (admin: 60 s)
                                        ▲
Clerk ── webhooks (user.created/updated/deleted, Svix-signed) ── instant ban/role/delete sync
```
* **No passwords, login codes, TOTP secrets, refresh tokens or session cookies** are managed by this API - Clerk owns sign-in, MFA and sessions.
* **Self-service sign-up with approval**: users create Clerk accounts directly and verify their email. Accounts without a server-assigned role are mirrored as `pending`; all protected REST and WebSocket access returns `403 APPROVAL_PENDING` until an admin approves them.
* **Voice notes** are recorded and AES-GCM-encrypted in the browser. The server stores opaque ciphertext only; clips are limited to 30 seconds / 160 KiB and expire with messages after 10 hours.
* **Approval**: `POST /admin/users/{id}/approve` sets the Clerk `public_metadata.role = "user"`, activates the local account and writes an audit record. The client cannot set this role.
* Admin invitations remain optional; invitations created by this API are stamped with `public_metadata.role = "user"` and are therefore approved on registration.
* **Admins** are Clerk users with `public_metadata.role = "admin"`. Admin endpoints re-verify role/ban against Clerk when the mirror is >60 s old.
* Admins can assign `admin`/`user` roles and mark any account as a verified Management Team member from the Users page. Role changes revoke the target's active sessions; the verified badge is displayed in directories and conversations.
* **Ban/disable**: `PATCH /admin/users/{id} {"status":"disabled"}` bans in Clerk, revokes their Clerk sessions, and force-closes their WebSockets; the local mirror blocks them immediately (`403 ACCOUNT_DISABLED`).
* Clerk session tokens live ~60 s - the frontend must call `getToken()` for every request (the Clerk SDK does this and caches for you).
* WebSockets can't send headers, so `POST /auth/ws-ticket` (Clerk-authenticated) returns a single-use 30 s ticket for `/ws?ticket=…`.

## Quick start (local)
```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt          # production image uses requirements.lock
cp .env.example .env                          # fill the Clerk values (below)
docker compose up -d db redis                 # or point DATABASE_URL at Neon
alembic upgrade head
python -m app.cli.bootstrap_admin --email you@company.com   # first admin
uvicorn app.asgi:app --reload --no-access-log
```

### Clerk dashboard setup (once)
1. **API keys** → `CLERK_SECRET_KEY`. **Frontend API URL** (Domains page) → `CLERK_ISSUER`.
2. Allow public sign-up, require verified email, and enable MFA for admin accounts. The API independently keeps every new account pending until admin approval.
3. **Webhooks** → add endpoint `https://<api-host>/api/v1/webhooks/clerk`, subscribe to `user.created`, `user.updated`, `user.deleted`; copy the signing secret → `CLERK_WEBHOOK_SECRET`.
4. Optional but recommended: require MFA for everyone (Clerk → Multi-factor) - this replaces the old admin TOTP.
5. `python -m app.cli.bootstrap_admin --email you@company.com` promotes that Clerk user to admin (or sends an admin invitation if they have no account yet). More admins: Clerk → Users → *Metadata → Public* → `{"role": "admin"}`.

### Neon
* `DATABASE_URL` = **pooled** endpoint (`-pooler`), `DATABASE_URL_DIRECT` = direct endpoint (Alembic only).
* After the first migration run `sql/roles.sql` so the app connects as a DML-only role.
* **Set Neon's PITR window as short as your plan allows** - backups hold ciphertext beyond the 10 h TTL.

### Migrating from the hex-code version
Migration `0002` **deletes all legacy users, conversations and messages** (hex-code accounts can't be mapped to Clerk users), drops `refresh_tokens` and the credential columns, and adds `clerk_user_id`, `email`, `synced_at`. Migration `0003` adds the pending-approval state. Back up first if you have live data; users must register again and await approval.

## Tests
```bash
pytest tests/unit                                                      # no DB needed
TEST_DATABASE_URL=postgresql://vc:vc@localhost/vaultchat_test?sslmode=disable pytest   # + end-to-end tests
```
Integration tests use an in-memory Clerk double and **real RS256-signed session tokens**, so the production verification path is exercised. They **drop and recreate the schema** of `TEST_DATABASE_URL`.

## API summary (`/api/v1`, JSON camelCase, errors `{"error":{"code","message"}}`, `Authorization: Bearer <Clerk session token>`)
| Area | Endpoints |
|---|---|
| Session | `POST /auth/ws-ticket` |
| Me / directory | `GET /users/me` · `PUT /users/me/key` · `GET /users?q=&cursor=` |
| Admin | `POST/GET /admin/invitations` · `DELETE /admin/invitations/{id}` · `GET /admin/users` · `POST /admin/users/{id}/approve` · `PATCH /admin/users/{id}` (status) · `POST …/reset-key` · `POST …/revoke-sessions` · `DELETE /admin/users/{id}` · `GET /admin/audit` · `GET /admin/stats` · `GET /admin/broadcasts` |
| Conversations | `POST/GET /conversations` · `GET /{id}` · `GET /{id}/keys` · `POST /{id}/members` · `DELETE /{id}/members/{uid}` · `POST /{id}/keys/rotate` · `POST /{id}/keys/grant` · `POST /{id}/read` · `GET /{id}/messages?cursor=` |
| Webhook | `POST /webhooks/clerk` (Svix-signed, not in OpenAPI) |
| Health | `GET /healthz` (DB check) · `GET /livez` |

**Removed** (handled by Clerk): `/auth/login`, `/auth/refresh`, `/auth/logout`, `/admin/auth/*`, `/admin/users` creation + `reset-code`, `/admin/sessions`.

### WebSocket `wss://host/ws?ticket=…`
Client → server: `message.send` · `conversation.read` · `ping`. Server → client: `ready`, `message.new`, `message.ack` (`duplicate` for idempotent retries), `message.expired`, `key.rotated`, `key.granted`, `conversation.created|updated|removed|deleted`, `pong`, `error`.
Close codes: 4401 bad/used ticket · 4403 account disabled · 4408 idle · 4429 too many connections · 1009 frame too big.

### Frontend contract
* Send `Authorization: Bearer ${await getToken()}` on every call (Clerk React/Next: `useAuth().getToken()`).
* First authenticated call provisions the user; `GET /users/me` → `hasPublicKey:false` means run key setup (`PUT /users/me/key`, base64 SPKI ECDH P-256, generated with WebCrypto, private key non-extractable in IndexedDB).
* A *different* key is refused (409). Lost device ⇒ an admin runs **reset-key**; the user enrols again and rejoins conversations.
* Crypto: AES-GCM, 12-byte nonce, AAD = conversationId‖senderId‖keyVersion, ciphertext 16-262144 bytes; message migration `0005` expands the DB check and WebSocket frame limit for encrypted voice notes. Every member needs a wrapped key on create/add/rotate; stale `keyVersion` ⇒ `KEY_VERSION_STALE`.

## Security design (as implemented)
* **Tokens**: RS256 only, signature + issuer + expiry/nbf verified; `azp` must be an allowed origin; pending sessions rejected; `alg=none`/HS256 confusion tests included. JWKS cached 1 h (`503 AUTH_UNAVAILABLE` if Clerk is unreachable and no key is cached).
* **Provisioning**: public registrations are pending until admin approval; usernames are derived and made unique; first-login races are handled.
* **Webhooks**: Svix HMAC-SHA256, constant-time compare, 5-minute replay window; endpoint disabled (503) without a secret.
* **Authorization**: membership checked on every call and WS event; non-members get the same answer as for missing resources; broadcast posting needs owner/sender; `sender_id`/`expires_at`/roles never client-supplied.
* **Retention**: DB-assigned `expires_at`, filtered on every read, purge at startup and every 60 s (batched, `SKIP LOCKED`), plus cleanup of tickets, superseded keys and >90-day audit rows.
* **Hygiene**: CSP/HSTS/nosniff/no-referrer/no-store, strict CORS (no credentials), 256 KB body cap, request ids, JSON logs without bodies/tokens/query strings, upstream (Clerk) error details never returned to clients, validation errors never echo input.
* **Rate limits**: WS 20 msg/10 s, ws-ticket 30/min. Clerk itself provides sign-in brute-force protection, bot detection and MFA.

## Behavioural decisions worth knowing
1. **Clerk is the source of truth** for identity, e-mail, display name, role and ban state; the local `users` row is a mirror plus the E2EE public key. Admin cannot edit display names - change them in Clerk.
2. **Admins are not chat users**: they cannot join direct chats or user-created groups; they create **broadcast channels** (and groups if `ALLOW_USER_GROUP_CREATION=false`). Admin accounts are managed only in the Clerk dashboard (`ADMIN_PROTECTED`).
3. **reset-key** clears the key, deletes the user's direct chats and removes their wrapped keys from groups/broadcasts (flagged `rotationRequired`); after re-enrolment any member holding the key can `POST /keys/grant`, and the owner should `rotate`.
4. **Deleting a user** deletes the Clerk account first (so it cannot re-provision), then removes them from groups (ownership passes to the longest-standing member) and deletes their direct chats.
5. Schema additions vs `database.md`: `users.clerk_user_id/email/synced_at`, `conversations.rotation_required`, `ws_tickets`; credential columns and `refresh_tokens` removed.
6. No forward secrecy in the MVP (static ECDH keys); metadata (who/when/size) is visible to the server.

## Operations
* **>1 instance or worker ⇒ set `REDIS_URL`** (shared rate limits and WS fan-out).
* Behind a proxy set `TRUST_PROXY_HEADERS=true` and `TRUSTED_PROXY_COUNT`; terminate TLS (WSS) and forward `Upgrade` headers. Disable proxy access logs for `/ws` (tickets travel in the query string; they are single-use and 30 s).
* A Clerk outage blocks new sign-ins and Backend-API actions (invite/ban); already-cached users keep working until their mirror TTL lapses, and chat messaging continues over open sockets.
* Alert on: 5xx rate, purge lag (`lastPurgeAt`), webhook 401s, `AUTH_UNAVAILABLE`/`UPSTREAM_*` error codes.
