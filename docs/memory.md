# memory.md — Project Memory / Current State

_Last updated: 2026-10-20_

## Current Phase
Clerk authentication and approval workflow implementation.

## Current Task
Enable direct Clerk sign-up with admin approval before application access.

## Completed
- [x] PRD.md
- [x] architecture.md
- [x] database.md
- [x] rules.md
- [x] phases.md
- [x] design.md (palette estimated from reference image)
- [x] memory.md
- [x] System_Design.md

## Files Currently Being Modified
None.

## Pending (high level)
- [ ] Validate pending signup, approval, rejection and disabled-user flows against configured Clerk and Postgres.
- [ ] Continue the remaining roadmap in phases.md.

## Known Bugs / Current Errors
None (no code yet).

## Important Decisions
| # | Decision | Rationale |
|---|---|---|
| D1 | Name: VaultChat (placeholder) | User gave no name |
| D2 | Modular monolith (FastAPI) + Next.js 15 + Tailwind + Neon | Matches requested stack; simple, fast |
| D4 | E2EE via WebCrypto (ECDH P-256 + AES-256-GCM), per-conversation key wrapped per member | Uniform for 1:1, group, broadcast |
| D5 | Clerk handles user credentials and sessions; new users remain pending until admin approval | Centralized identity, email verification and managed sessions |
| D6 | Admin login uses Clerk with required MFA; admin role is server-managed | Admin is the highest-value target |
| D7 | 10 h TTL = DB-set `expires_at` + purge job + read filter | Correct even if purge lags |
| D8 | "One to many" = group chat + broadcast channel | Assumption |
| D9 | No forward secrecy in MVP (static ECDH keys); 10 h TTL limits exposure | Double Ratchet deferred to future |

## Open Questions
1. Hosting targets (Vercel + VPS/Render/Fly?) for Phase 12.
2. Exact hex colours — please confirm by eyedropper from original image if pixel-match is required.

## Recent Changes
- 2026-10-19: Documentation set created.
- 2026-10-20: Product auth changed to public Clerk registration with admin approval.

## Next Task
Complete integration validation using a configured test Postgres and Clerk dashboard.

## Deployment Status
Not started.
