# PRD.md — Product Requirements

> Source of truth for WHAT we are building. Working name: **VaultChat** (rename freely).

## 1. Overview
VaultChat is an end-to-end encrypted (E2EE) chat application. Anyone may create an account with Clerk, but a new account stays pending until an admin approves it. Messages are readable only by conversation members (the server stores ciphertext only) and are **automatically deleted 10 hours after being sent**.

## 2. Problem Statement
Teams/groups that need private communication have no control over who joins, and mainstream chat apps keep history forever and let the provider read it. We need a closed, admin-governed chat where nothing lingers and the server cannot read content.

## 3. Goals
- Public Clerk sign-up with admin approval required before any application access.
- E2EE for every conversation type.
- Ephemeral history: 10-hour TTL, enforced server-side.
- Fast real-time delivery (WebSocket).
- Distinctive 3D/glassmorphism UI matching the reference dashboard image.

## 4. Target Users
Small to mid-size private groups (company teams, communities, project groups) managed by one or more admins.

## 5. User Roles
| Role | Capabilities |
|---|---|
| **Admin** | Sign in with Clerk and MFA; approve/disable/delete users; view user list and audit log; create broadcast channels; cannot read message content. |
| **User** | Sign up/sign in with Clerk; await admin approval; after approval use 1:1 chat, group chat, broadcast channels and device settings. |

## 6. Core Features
1. **Self-service registration** — user creates a Clerk account and verifies their email; application access remains pending.
2. **Admin approval** — admin reviews new registrations and approves or rejects them.
3. **Clerk authentication** — users and admins sign in with Clerk; MFA is required for admins.
4. **One-to-One chat** (E2EE).
5. **One-to-Many**: (a) **Group chat** (many ↔ many), (b) **Broadcast channel** (one sender → many read-only receivers). *Assumption — see Open Questions.*
6. **End-to-End Encryption** — client-side keys, server stores ciphertext only.
7. **Auto-clear after 10 hours** — server purge + client purge + expiry countdown in UI.
8. **Real-time messaging** over WebSockets.
9. **Voice messages** — record, preview, and send encrypted audio notes up to 30 seconds.
10. **Admin dashboard** — users, active sessions, audit log, security status.

## 7. Functional Requirements
- FR1: Only authenticated admins can call user-management endpoints; only approved users can use chat APIs or WebSockets.
- FR2: New Clerk accounts are mirrored as `pending`; they receive no application access before approval.
- FR3: Admin approval sets the Clerk user role and activates the local account; rejection deletes the registration.
- FR4: Admin can disable/enable/delete a user and reset a device key.
- FR5: Users can start a 1:1 chat with any active user.
- FR6: Users can create groups with active users; owners can add/remove members, edit group names/icons, and delete a group for everyone.
- FR7: Messages are encrypted in the browser before sending; decrypted in the browser after receiving.
- FR8: Each message has `expires_at = created_at + 10h`; expired messages are never returned and are physically deleted.
- FR9: Unread counts per conversation.
- FR10: Clerk manages sign-in, MFA and sessions; the API verifies Clerk session JWTs.
- FR11: All admin actions are written to an audit log.
- FR12: Users can record, preview, send, and play end-to-end encrypted voice notes up to 30 seconds; recordings remain ciphertext-only on the server and follow the standard message expiry.

## 8. Non-Functional Requirements
| Area | Target |
|---|---|
| Latency | p95 message delivery < 300 ms (same region) |
| Throughput | 1,000 concurrent WebSocket connections per instance |
| Availability | 99.5% (MVP) |
| Security | OWASP ASVS L2 as baseline; see rules.md |
| Retention | Hard delete ≤ 60 s after expiry |
| Browser | Latest 2 versions of Chrome, Edge, Firefox, Safari |
| Accessibility | WCAG 2.1 AA |

## 9. Pages / Screens
**Public:** `/` Landing page, `/login`, `/signup`, `/admin/login`
**User:** `/dashboard` Dashboard, `/chats`, `/chats/[id]`, `/groups/new`, `/broadcasts`, `/settings`
**Admin:** `/admin` Dashboard, `/admin/users`, `/admin/users/new`, `/admin/audit`, `/admin/security`

## 10. User Journeys
- **Onboarding:** User signs up and verifies email → account is pending → admin approves → user signs in → browser generates keypair → public key uploaded → ready.
- **Send message:** open chat → type or record a voice note → encrypt locally → WS send → server stores ciphertext + `expires_at` → fan-out → recipients decrypt.
- **Expiry:** message shows countdown; at 10 h it disappears everywhere.
- **Lost device:** admin regenerates code → user logs in on new device → new keypair (old messages already expired or unreadable).

## 11. Authentication Requirements
- Clerk handles user/admin sign-up, sign-in, email verification, MFA and session rotation.
- User sign-up is available publicly, but new accounts stay pending and cannot use REST chat endpoints or WebSockets until approved.
- Clerk `public_metadata.role` is server-managed: `user` after admin approval and `admin` only through a trusted bootstrap/admin process. Client-set metadata is never trusted.
- Require verified email for users and MFA for admins. The API validates Clerk JWT signature (RS256/JWKS), issuer, expiry, authorized party and session state.
- Pending and disabled accounts receive generic, explicit access-denied states; admin approval/rejection actions are audited.

## 12. Admin Requirements
Review and approve/reject pending users; disable/enable/delete users; reset device keys; revoke sessions; view audit log; create broadcast channels.

## 13. API Requirements
REST (`/api/v1`) for auth, users, conversations, history; WebSocket (`/ws`) for real-time. Full spec in System_Design.md.

## 14. Notifications
In-app unread badges and (optional, Phase 2) browser notifications with generic text ("New message") — never content.

## 15. Integrations
None for MVP. Neon (Postgres) only. Optional Redis for multi-instance fan-out (later).

## 16. Future Features
Forward secrecy (Double Ratchet), encrypted attachments with TTL, read receipts, typing indicators, multi-device key sync, mobile app, per-conversation custom TTL.

## 17. Out of Scope (MVP)
Public access without approval, live voice/video calls, general file attachments, message editing, search, server-side message moderation, federation.

## 18. Open Questions / Assumptions
1. **"One to many"** assumed = group chat + admin-controlled broadcast channel.
2. **Who creates groups?** Assumed: any approved user; broadcast channels: admin only.
3. **"Non-hackable"** is not achievable in absolute terms; we target defense-in-depth (see rules.md §Security).
