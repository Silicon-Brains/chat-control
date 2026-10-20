# phases.md — Development Roadmap

Legend: `- [ ]` todo · `- [x]` done. Each phase ends with something runnable.

---
## Phase 1 — Project Setup
**Objective:** Monorepo, tooling, Neon connection.
**Tasks**
- [ ] Create `frontend/` (Next.js 15 + TS + Tailwind) and `backend/` (FastAPI)
- [ ] Lint/format/type tools (ESLint, Prettier, ruff, mypy), pre-commit + gitleaks
- [ ] `.env.example`, Neon project (pooled + direct URLs)
- [ ] Alembic initialised; health endpoint `/healthz`
**Files:** `frontend/*`, `backend/app/main.py`, `alembic/`
**Dependencies:** none
**Expected result:** both apps run locally; backend reaches Neon.
**Done when:** `GET /healthz` returns DB OK; CI green.

## Phase 2 — UI Foundation (design system)
**Objective:** Glass/3D design tokens and base components per design.md.
**Tasks**
- [ ] Tailwind theme tokens (colors, radius, shadows, blur)
- [ ] Background gradient + glow layers
- [ ] `GlassCard`, `Button`, `Input`, `Badge`, `StatTile`, `Sidebar`, `Topbar`, `Avatar`
- [ ] App shell layout (sidebar + header + content grid), responsive
- [ ] Static dashboard page matching reference image
**Files:** `tailwind.config`, `components/ui/*`, `app/(app)/layout.tsx`
**Dependencies:** Phase 1
**Expected result:** pixel-close dashboard shell with mock data.
**Done when:** visual review vs reference image approved; Lighthouse a11y ≥ 90.

## Phase 3 — Database & Models
**Objective:** Schema live on Neon.
**Tasks**
- [ ] ORM models + first migration (all tables in database.md)
- [ ] Indexes + constraints; app DB role with least privilege
- [ ] Repositories skeleton
**Dependencies:** Phase 1
**Expected result:** migrated schema.
**Done when:** `alembic upgrade head` clean on fresh DB; constraint tests pass.

## Phase 4 — Authentication & Admin Bootstrap
**Objective:** Secure login for admin and users.
**Tasks**
- [ ] `bootstrap_admin` CLI (admin code + TOTP QR)
- [ ] Admin login (code + TOTP), user login (username + hex code)
- [ ] Argon2id, rate limit, lockout, audit logging
- [ ] JWT access + rotating refresh cookie; logout; reuse detection
- [ ] Login pages (user/admin) + route guards
**Dependencies:** Phases 2, 3
**Expected result:** both roles can log in/out securely.
**Done when:** brute-force & token-reuse tests pass.

## Phase 5 — Admin User Management
**Objective:** Admin-only account creation.
**Tasks**
- [ ] Create user → generate 10-hex code → show once (copy button, auto-hide)
- [ ] Disable/enable/delete, reset code (revokes sessions + key)
- [ ] Users table, audit log page
**Dependencies:** Phase 4
**Expected result:** admin can onboard users; non-admin gets 403.
**Done when:** authz tests pass; code never retrievable after creation.

## Phase 6 — Crypto & Key Management (frontend)
**Objective:** E2EE primitives.
**Tasks**
- [ ] Keypair generation on first login, IndexedDB non-extractable storage
- [ ] Register public key; directory endpoint
- [ ] Conversation key gen, wrap/unwrap (ECDH + HKDF + AES-GCM)
- [ ] Encrypt/decrypt message utils + fingerprint display
**Files:** `lib/crypto/*`
**Dependencies:** Phase 4
**Expected result:** tested crypto library.
**Done when:** round-trip + tamper-detection unit tests pass.

## Phase 7 — Conversations & Messaging (1:1, group, broadcast)
**Objective:** Real-time encrypted chat.
**Tasks**
- [ ] Conversation REST (create/list/members) with membership checks
- [ ] WebSocket hub, ticket auth, send/receive, fan-out
- [ ] History pagination, unread counts, last_read
- [ ] Chat UI (list, thread, composer, expiry countdown)
- [ ] Group member add/remove → key rotation
**Dependencies:** Phases 3, 4, 6
**Expected result:** working chat across all three types.
**Done when:** two browsers exchange encrypted messages; server DB shows only ciphertext.

## Phase 8 — Auto-Clear (10 h TTL)
**Objective:** Guaranteed ephemerality.
**Tasks**
- [ ] Purge scheduler (60 s, batched) + startup catch-up
- [ ] Read-path `expires_at > now()` filter everywhere
- [ ] WS `message.expired` event; client timers purge UI + memory
- [ ] Purge expired tokens/old key versions
**Dependencies:** Phase 7
**Expected result:** nothing older than 10 h is retrievable.
**Done when:** time-travel test (mocked clock) passes; rows physically gone ≤ 60 s.

## Phase 9 — Dashboard, Polish & 3D
**Objective:** Match reference visuals.
**Tasks**
- [ ] User dashboard cards (active chats, unread, expiring soon, key status)
- [ ] Admin dashboard cards (users, sessions, failed logins)
- [ ] 3D illustration banner (optimised assets), micro-animations
- [ ] Empty/loading/error states
**Dependencies:** Phases 2, 7
**Done when:** design review passes; reduced-motion respected.

## Phase 10 — Security Hardening & Testing
**Tasks**
- [ ] CSP/HSTS/headers, CORS tightening, cookie flags
- [ ] Pen-test checklist (IDOR, XSS, CSRF, WS abuse, enumeration)
- [ ] Load test (1k WS), dependency audit, Playwright e2e
**Done when:** no high/critical findings; targets in PRD §8 met.

## Phase 11 — Optimization
- [ ] Query plans reviewed, indexes verified; WS payload tuning
- [ ] Bundle analysis; lazy-load heavy visuals
- [ ] Optional Redis pub/sub for multi-instance fan-out

## Phase 12 — Deployment
- [ ] Frontend (Vercel or container), backend (container behind TLS proxy), Neon prod branch
- [ ] CI/CD, secrets manager, monitoring/alerts, runbook
**Done when:** production smoke test passes; memory.md updated.
