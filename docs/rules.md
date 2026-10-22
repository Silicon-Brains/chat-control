# rules.md — Development Rules

## 1. Coding Standards
| DO | DON'T |
|---|---|
| TypeScript `strict` on the frontend; type hints + `mypy`/`ruff` on the backend | Use `any`, untyped dicts across layers |
| Small, single-purpose functions/components | Copy-paste logic; create duplicate components |
| Reuse existing utils/components first | Rewrite working code without reason |
| Document architecture changes in the .md files first | Change stack/architecture silently |

## 2. Naming Conventions
- Python: `snake_case` files/functions, `PascalCase` classes. Pydantic schemas: `UserCreate`, `UserOut`.
- TS: `PascalCase` components, `camelCase` functions/vars, `kebab-case` folders/files for non-components.
- DB: `snake_case`, plural tables, `_at` for timestamps, `_id` for FKs.
- API paths: lowercase, plural nouns, versioned `/api/v1`.

## 3. Folder & Component Conventions
- Follow architecture.md §11 exactly.
- UI primitives in `components/ui/`; feature components in `components/<feature>/`.
- Backend: router → service → repository. No SQL in routers; no HTTP in repositories.

## 4. API Conventions
- JSON, camelCase on the wire (alias generator), UTC ISO-8601 timestamps.
- Errors: `{ "error": { "code": "...", "message": "..." } }`; never leak stack traces or whether a username exists.
- Cursor pagination; max page size 100.

## 5. Database Conventions
- All changes via Alembic migrations; never edit schema by hand.
- Parameterized queries only (SQLAlchemy); no string-built SQL.
- Update database.md in the same PR as any schema change.

## 6. Security Rules (critical)
**DO**
- Let Clerk handle passwords, email verification, MFA and sessions; verify Clerk JWTs (RS256/JWKS, issuer, expiry, authorized party).
- Allow direct Clerk sign-up, but create local accounts as `pending` and deny API/WebSocket access until explicit admin approval.
- Set Clerk public role metadata only from trusted backend/admin bootstrap paths; never trust client-supplied role claims.
- Require verified email for users and MFA for admins.
- Audit registration, approval, rejection, disable/enable and delete actions.
- Encrypt in browser; private key `extractable: false`; store only in IndexedDB.
- When local key storage is lost, require explicit confirmation before self-service key reset; reset removes the user's wrapped conversation keys and requires group-key rotation.
- Validate membership on every REST call **and** every WS event.
- Set headers: strict CSP (no inline scripts, nonces), HSTS, `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `frame-ancestors 'none'`.
- Strict CORS allow-list; cookies `HttpOnly; Secure; SameSite=Strict`.
- Cap message ciphertext at 256 KiB; voice notes are limited to 30 seconds and 160 KiB before encryption. WS rate limit 20 msgs / 10 s.
- Record voice notes in the browser and encrypt them with the conversation key before sending; never upload raw audio.
- Write audit logs for all admin actions and failed logins (no content, no secrets).
- Pin and audit dependencies (`pip-audit`, `npm audit`) in CI.

**DON'T**
- Don't log request bodies, ciphertext, tokens, or codes.
- Don't put tokens in URLs or localStorage.
- Don't use `dangerouslySetInnerHTML`; render messages as text.
- Don't implement custom crypto primitives; use WebCrypto only.
- Don't trust client-supplied `expires_at`, `sender_id`, or role.
- Don't claim "unhackable" — state threat model honestly.

## 7. Authentication Rules
- Clerk owns credentials and web sessions. The API accepts only verified Clerk session JWTs.
- Pending or disabled local accounts cannot use REST or WebSocket endpoints.
- Approval writes `public_metadata.role=user` through Clerk's Backend API and changes the local account to active; approval is auditable.
- `public_metadata.role=admin` is granted only through a trusted bootstrap/admin operation.
- WS: exchange an approved Clerk session for a one-time ticket (30 s TTL), consumed on connect.
- Reset-device-key ⇒ revoke sessions as appropriate and clear the public key.

## 8. Environment Variables
- `.env` never committed; `.env.example` lists names only.
- Required: `DATABASE_URL`, `DATABASE_URL_DIRECT`, `CLERK_SECRET_KEY`, `CLERK_ISSUER`, `ALLOWED_ORIGINS`, `ENV`.
- Frontend exposes only `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`.
- No secret may appear in `NEXT_PUBLIC_*`.

## 9. Error Handling
- Backend: global exception handlers; log with request-id; return safe messages.
- Frontend: error boundaries per route; toast for recoverable errors; WS reconnect with exponential backoff + jitter.

## 10. Validation
- Pydantic v2 `extra="forbid"` on all inputs; Zod on frontend forms.
- Usernames: `^[a-z0-9_]{3,24}$` (derived from Clerk profile and uniquified by the server).

## 11. Responsive & Accessibility
- Mobile-first; breakpoints per design.md.
- Keyboard navigable, visible focus ring, ARIA labels on icon buttons, contrast ≥ 4.5:1 (check glass cards over gradient), respect `prefers-reduced-motion`.

## 12. Git / GitHub
- Branches: `main` (protected), `feat/*`, `fix/*`. Conventional Commits.
- PR required; CI (lint, types, tests, audit) must pass. No secrets in history (use gitleaks pre-commit).

## 13. Dependencies
- Add only when necessary; justify in PR. Prefer platform APIs (WebCrypto, native WebSocket).
- Pin versions; lockfiles committed.

## 14. Performance
- Index every query path; no N+1 (use joins/`selectinload`).
- Paginate history (50). Virtualize long message lists.
- Lazy-load 3D/heavy visuals; images via `next/image`; keep JS bundle lean.
- WS payloads compact; batch receipts.

## 15. Testing
- Backend: pytest + httpx; cover Clerk token validation, pending-to-approved lifecycle, authz, purge, WS membership.
- Frontend: Vitest for crypto utils (round-trip, tamper detection); Playwright for login → send → expiry flows.
- Security tests: IDOR checks, brute-force lockout, token reuse, CSP presence.
- Minimum 80% coverage on `services/` and `lib/crypto/`.
