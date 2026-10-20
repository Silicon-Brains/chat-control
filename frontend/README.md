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
  app/(auth)/login, signup, admin/login     public pages
  app/(app)/                        user area: dashboard, chats/[id], groups, broadcasts, settings
  app/admin/                        admin area: dashboard, users, audit, security
  components/ui|layout|auth|chat|admin
  lib/crypto/   keys (IndexedDB, non-extractable) · wrap (ECDH+HKDF+AES-GCM) · message (AES-GCM + AAD) · keyring
  lib/api/      fetch client (Clerk session token provider) + typed endpoints
  lib/ws/       ticket-auth WebSocket, backoff + jitter, event bus
  lib/chat/     decrypt pipeline, outgoing prep, conversation creation (key wrapping)
  stores/       session · chat · toast      hooks/   types/   middleware.ts (Clerk route protection + CSP nonce)
```

## Security notes
- Clerk manages user/admin sessions. The backend validates the Clerk session JWT and independently enforces approval.
- Private key `extractable:false`, stored in IndexedDB; conversation keys unwrapped as non-extractable and held in memory.
- AES-GCM AAD = `conversationId|senderId|keyVersion`. Messages rendered as text only.
- Per-request CSP with nonce + strict-dynamic, HSTS, `frame-ancestors 'none'`, no-referrer.
- Clerk session tokens are requested for each API call and are never stored in localStorage.
- Pending registrations receive an approval screen and cannot start chat or register keys.

## Backend contract
- `GET /users/me` provisions/synchronizes the Clerk identity; pending users receive `403 APPROVAL_PENDING`.
- `POST /admin/users/{id}/approve` grants the user role server-side and activates the account.
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
| `/admin/login` | `admin` | mock admin credentials are defined in `src/lib/api/mock.ts` |

Encryption still runs for real in your browser; sent messages loop back to you (no other live users).

## Clerk sign-in and user approval

Users sign up and sign in with Clerk at `/signup` and `/login`. New accounts appear in the admin Users page as **pending** and cannot access chats until approved. Admins sign in through `/admin/login` and need the server-managed `role=admin`.

1. Create a Clerk application and set the publishable and secret keys plus issuer in the frontend/backend env files.
2. Enable public sign-up and require verified email in Clerk. Do not lock sign-up to invitations.
3. Require MFA for admin accounts. Mark only trusted admin identities with Clerk **public metadata** `{ "role": "admin" }` or use the backend bootstrap CLI.
4. The frontend reads admin metadata only for navigation; the backend independently fetches and verifies the Clerk role, so session-token metadata is not an authorization source.
5. Admin approves each new account in `/admin/users`. Approval is performed server-side, audited, and only then grants the user's Clerk role and API access.

Clerk wraps the application so user and admin pages can request fresh session tokens. With `NEXT_PUBLIC_MOCK=true`, Clerk is bypassed and the in-browser demo accounts are used.
