# memory.md — Project Memory / Current State

_Last updated: 2026-10-19_

## Current Phase
Phase 0 — Documentation foundation (complete). Next: **Phase 1 — Project Setup**.

## Current Task
Review and approve the documentation set, then answer the open questions below.

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
- [ ] Phase 1 → Phase 12 per phases.md

## Known Bugs / Current Errors
None (no code yet).

## Important Decisions
| # | Decision | Rationale |
|---|---|---|
| D1 | Name: VaultChat (placeholder) | User gave no name |
| D2 | Modular monolith (FastAPI) + Next.js 15 + Tailwind + Neon | Matches requested stack; simple, fast |
| D3 | "Python socket programming" → FastAPI native WebSockets | Async, browser-compatible; raw TCP sockets cannot be used from browsers |
| D4 | E2EE via WebCrypto (ECDH P-256 + AES-256-GCM), per-conversation key wrapped per member | Uniform for 1:1, group, broadcast |
| D5 | 10-hex user code stored as Argon2id hash, login = username + code | 40-bit code needs rate limiting + lockout |
| D6 | Admin login = long admin code + mandatory TOTP | Admin is the highest-value target |
| D7 | 10 h TTL = DB-set `expires_at` + purge job + read filter | Correct even if purge lags |
| D8 | "One to many" = group chat + broadcast channel | Assumption |
| D9 | No forward secrecy in MVP (static ECDH keys); 10 h TTL limits exposure | Double Ratchet deferred to future |

## Open Questions (need user answer)
1. Confirm "one to many" meaning (group + broadcast?).
2. Can any user create groups, or admin only?
3. Add optional user passphrase on first login to strengthen the 40-bit hex code? (recommended)
4. Hosting targets (Vercel + VPS/Render/Fly?) for Phase 12.
5. Exact hex colours — please confirm by eyedropper from original image if pixel-match is required.

## Recent Changes
- 2026-10-19: Documentation set created.

## Next Task
Answer open questions → start Phase 1 (scaffold `frontend/` and `backend/`, connect Neon).

## Deployment Status
Not started.
