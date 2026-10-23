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

## Phase 4 — Clerk Authentication & Admin Bootstrap
**Objective:** Clerk sign-in for admins and users, with server-enforced user approval.
**Tasks**
- [x] Clerk session JWT verification, identity mirroring and Clerk admin bootstrap
- [ ] Public Clerk sign-up, email verification and user/admin sign-in pages
- [ ] Provision self-signups as pending; deny pending users on protected REST paths
- [ ] Admin approval promotes a pending Clerk account; audit approval and rejection
- [ ] Clerk-based route guards and MFA for admins
**Dependencies:** Phases 2, 3
**Expected result:** users can sign up and sign in, but cannot use the application before admin approval.
**Done when:** pending access is denied across REST, approval activates access, and admin authorization tests pass.

## Phase 5 — Admin User Management
**Objective:** Admin review and approval of self-registered accounts.
**Tasks**
- [x] Users table, disable/enable/delete, reset device key
- [ ] Pending-user queue with approve/reject actions
- [ ] Keep invitation flow as an optional alternative onboarding path
**Dependencies:** Phase 4
**Expected result:** admin can approve signups; pending users remain blocked; non-admin gets 403.
**Done when:** approval and denial are audited and authorization tests pass.

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
- [x] Authenticated REST message writes and Postgres-backed polling sync
- [ ] History pagination, unread counts, last_read
- [ ] Chat UI (list, thread, composer, expiry countdown)
- [ ] Group member add/remove → key rotation
**Dependencies:** Phases 3, 4, 6
**Expected result:** working chat across all three types.
**Done when:** two browsers exchange encrypted messages through REST polling; server DB shows only ciphertext.

## Phase 8 — Auto-Clear (10 h TTL)
**Objective:** Guaranteed ephemerality.
**Tasks**
- [ ] Purge scheduler (60 s, batched) + startup catch-up
- [ ] Read-path `expires_at > now()` filter everywhere
- [x] Client timers prune expired messages; database polling excludes expired rows
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
- [ ] Pen-test checklist (IDOR, XSS, CSRF, API abuse, enumeration)
- [ ] Load test (1k WS), dependency audit, Playwright e2e
**Done when:** no high/critical findings; targets in PRD §8 met.

## Phase 11 — Optimization
- [ ] Query plans reviewed and indexes verified; polling load tuned
- [ ] Bundle analysis; lazy-load heavy visuals
- [ ] Optional Redis pub/sub for multi-instance fan-out

## Phase 12 — Deployment
- [ ] Frontend (Vercel or container), backend (container behind TLS proxy), Neon prod branch
- [ ] CI/CD, secrets manager, monitoring/alerts, runbook
**Done when:** production smoke test passes; memory.md updated.
