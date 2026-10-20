# VaultChat — Frontend

Next.js 15 (App Router) · TypeScript strict · Tailwind 3 · Zustand · TanStack Query · native WebCrypto.
Implements `docs/design.md` (glass / teal), `docs/rules.md` and `docs/architecture.md` §3, §11–13.

## Run
```bash
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
npm run typecheck && npm run lint && npm test
```

## Structure
```
src/
  app/(auth)/login, admin/login     public pages
  app/(app)/                        user area: dashboard, chats/[id], groups, broadcasts, settings
  app/admin/                        admin area: dashboard, users, audit, security
  components/ui|layout|auth|chat|admin
  lib/crypto/   keys (IndexedDB, non-extractable) · wrap (ECDH+HKDF+AES-GCM) · message (AES-GCM + AAD) · keyring
  lib/api/      fetch client (memory token, single-flight refresh) + typed endpoints
  lib/ws/       ticket-auth WebSocket, backoff + jitter, event bus
  lib/chat/     decrypt pipeline, outgoing prep, conversation creation (key wrapping)
  stores/       session · chat · toast      hooks/   types/   middleware.ts (CSP nonce)
```

## Security notes
- Access token in memory only; refresh is an HttpOnly cookie handled by the API.
- Private key `extractable:false`, stored in IndexedDB; conversation keys unwrapped as non-extractable and held in memory.
- AES-GCM AAD = `conversationId|senderId|keyVersion`. Messages rendered as text only.
- Per-request CSP with nonce + strict-dynamic, HSTS, `frame-ancestors 'none'`, no-referrer.
- Login errors are generic; codes are shown once, auto-hide after 30 s, never persisted.

## Backend contract assumed (not in the docs — add to System_Design.md)
- `POST /auth/refresh` → `{ accessToken, user }`; `user = { id, username, displayName, role, keyFingerprint }` (fingerprint = first 32 hex of SHA-256(SPKI)).
- `GET /conversations` → `Conversation[]` including `members`, this user's `keys[]` (all live versions), `myRole`, `unreadCount`, `lastMessageAt`, `nextExpiryAt`.
- `GET /conversations/{id}/messages` → `{ items, nextCursor }`; `POST /conversations/{id}/read` marks read.
- `message.send` carries a client UUID `id` (idempotent); the server fans out `message.new` to the sender too.
- `GET /admin/audit` → `{ items, nextCursor }` with `actorName`.
- Direct-chat creation returns the existing conversation if the pair already exists.

## Not included yet
Member add/remove + key rotation UI, broadcast-channel creation, message list virtualisation, Playwright e2e, browser notifications.

## Run without a backend (mock mode)
Set `NEXT_PUBLIC_MOCK=true` in `.env.local` and restart `npm run dev`. The API and WebSocket are faked in the browser (`src/lib/api/mock.ts`); data resets on page reload and **must never be enabled in production**.

| Where | Username | Code |
|---|---|---|
| `/login` | `alice` / `bob` / `carol` | `a1b2c3d4e5` / `b1b2c3d4e5` / `c1b2c3d4e5` |
| `/admin/login` | `admin` | admin code `local-admin-code-0123456789`, authenticator code `123456` |

Encryption still runs for real in your browser; sent messages loop back to you (no other live users).

## Admin auth with Clerk
Admins sign up and sign in through Clerk (`/admin/signup`, `/admin/login`). Regular users are unchanged (username + 10-hex code via your API).

1. Create a Clerk application; copy the keys into `.env.local` (see `.env.example`).
2. **Lock down sign-up** — otherwise anyone can create a Clerk account: Clerk Dashboard → *User & authentication* → set sign-up mode to *Restricted* (invitation-only) or add an allowlist; require MFA for admins.
3. Mark admins: Dashboard → Users → *Public metadata* → `{ "role": "admin" }`. Without it the user sees "No admin access".
4. Dashboard → *Sessions* → *Customize session token*: `{ "metadata": "{{user.public_metadata}}" }` so the API can read the role from the JWT.
5. **Backend change required:** `/api/v1/admin/*` must verify the Clerk session JWT (Clerk JWKS, issuer, `azp`) and require `metadata.role == "admin"`. The old `POST /admin/auth/login`, admin code, TOTP and `bootstrap_admin` CLI are no longer used by this frontend. Audit logs should record the JWT `sub` as the actor.

Clerk loads only on `/admin/*`. With `NEXT_PUBLIC_MOCK=true` Clerk is bypassed and the old fake admin login is used.
