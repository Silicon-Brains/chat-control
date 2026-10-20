# design.md — Design System

Reference: the supplied **CoachPro** dashboard screenshot. Style = soft **glassmorphism + 3D depth**, calm teal palette, rounded cards, pastel gradient background.

> Hex values are **estimated from the screenshot**. Before Phase 2, eyedrop the original image and update the tokens below if needed (this file is the single source).

## 1. Design Philosophy
Calm, premium, frosted. Content sits on translucent glass cards floating over a soft multi-colour gradient. Depth comes from blur, layered soft shadows, and one 3D hero illustration. Generous spacing, large rounded corners, minimal borders.

## 2. Color Palette
| Token | Hex / value | Use |
|---|---|---|
| `primary-600` | `#2F7378` | Active nav, buttons (gradient end) |
| `primary-500` | `#3E8C8F` | Primary, banner, links, chart bar |
| `primary-300` | `#8FBFBF` | Hover tints, outlines |
| `ink-900` | `#1E2B2A` | Headings |
| `ink-600` | `#5A6B6A` | Body/secondary text |
| `ink-400` | `#8A9A99` | Placeholder, table headers |
| `bg-mint` | `#CFE3E1` | Background base |
| `bg-sky` | `#BED3DB` | Background gradient |
| `bg-lavender` | `#C7C2EA` | Right-side glow |
| `bg-lemon` | `#E7EBC9` | Top-left glow |
| `glass` | `rgba(255,255,255,0.45)` | Card fill |
| `glass-border` | `rgba(255,255,255,0.70)` | Card border |
| `accent-purple` | `#8E7CE6` | Tile icon (e.g., Unread) |
| `accent-pink` | `#F06AA8` | Tile icon (e.g., Security) |
| `accent-orange` | `#F4A55B` | Tile icon (e.g., Expiring) |
| `accent-slate` | `#5E9CA6` | Tile icon (e.g., Status) |
| `success` | `#3E8C8F` | Success |
| `danger` | `#E8707A` | Errors, "lost"-style bar, destructive |
| `warning` | `#F4A55B` | Expiring soon |
| `lime-3d` | `#B6D84A` | 3D illustration accent only |

**Page background:**
```css
background:
  radial-gradient(60% 50% at 10% 0%, #E7EBC9 0%, transparent 60%),
  radial-gradient(50% 60% at 100% 40%, #C7C2EA 0%, transparent 60%),
  linear-gradient(135deg, #CFE3E1 0%, #BED3DB 100%);
```
**Primary gradient:** `linear-gradient(135deg, #3E8C8F, #2F7378)`.

## 3. Typography
- Font: **Plus Jakarta Sans** (closest match to reference); fallback `Inter, system-ui, sans-serif`. Load via `next/font`.
- Weights: 400 body, 500 labels, 600 headings/numbers, 700 page title.
| Style | Size / line-height |
|---|---|
| Page title (`Dashboard`) | 36 / 44, 700 |
| Card title | 15 / 22, 500 |
| Stat value | 28 / 34, 600 (unit suffix 18, 500) |
| Body | 14 / 22 |
| Caption/table head | 12 / 16, 500, uppercase optional |

## 4. Spacing, Radius, Shadows
- 4-pt scale: 4, 8, 12, 16, 20, 24, 32, 48.
- Card padding 24; grid gap 20.
- Radius: card `24px`, tile/button `16px`, input `14px`, pill `999px`, small icon tile `12px`.
- Shadows:
  - `shadow-glass`: `0 10px 30px rgba(47,115,120,0.12), inset 0 1px 0 rgba(255,255,255,0.8)`
  - `shadow-lift` (hover): `0 16px 40px rgba(47,115,120,0.20)`
- Glass: `backdrop-filter: blur(20px) saturate(140%)`.

## 5. Components
- **Buttons:** Primary = teal gradient, white text, radius 16, `shadow-glass`; Secondary = glass fill + teal text; Ghost = text only; Danger = `danger` tint. Height 44 (sm 36).
- **Cards (`GlassCard`):** glass fill, 1px glass-border, radius 24, `shadow-glass`; header row = title left, teal link right ("View all").
- **Stat tile:** icon in 40px rounded gradient square (accent colour), small caps label, large value.
- **Inputs:** glass fill, 1px `glass-border`, radius 14, focus ring 2px `primary-500` + glow; error ring `danger`.
- **Forms:** label above, helper text `ink-400`, inline validation.
- **Sidebar:** 240px glass panel; items 44px high, icon + label; active = teal gradient pill with white text; divider before secondary group. Logo wordmark top-left.
- **Topbar:** greeting (teal, 14) + title below; right = search, bell, avatar + name.
- **Chat bubbles:** incoming = glass; outgoing = teal gradient/white text; radius 20 (tail corner 6); timestamp + **expiry chip** ("9h 12m") in `ink-400`, turns `warning` under 1 h.
- **Tables:** no vertical lines, 56px rows, hairline row dividers `rgba(0,0,0,0.06)`, highlighted first row bold.
- **Modals:** glass panel on blurred scrim `rgba(30,43,42,0.35)`, radius 28.
- **Badges:** pill, tinted bg (accent 15%) + accent text. Unread = teal solid.
- **Icons:** Lucide, 20px, 1.75 stroke.
- **Progress bar:** 8px, teal fill, `danger` end segment (as "Games statistic").
- **3D hero banner:** teal card with floating 3D objects (export optimised WebP/AVIF or lightweight Three.js scene, lazy-loaded). CTA pill button.

## 6. States
- **Loading:** shimmer skeleton on glass cards; spinner only in buttons.
- **Empty:** centered soft illustration + one-line text + CTA.
- **Error:** inline `danger` message + retry; full-page error boundary on glass card.
- **Hover:** cards lift (`translateY(-2px)` + `shadow-lift`), nav items tint `rgba(62,140,143,0.10)`.
- **Focus:** always visible ring.
- **Disabled:** 50% opacity, no shadow.

## 7. Animations
150–250 ms ease-out. Page/card fade-up 8 px; message in = slide + fade; subtle float on 3D objects (6 s loop). Disable all under `prefers-reduced-motion`.

## 8. Responsive
| Breakpoint | Behaviour |
|---|---|
| `<640` mobile | Sidebar → bottom tab bar (5 icons); single column; chat full-screen |
| `640–1024` | Collapsed icon sidebar (72px); 2-col grid |
| `≥1024` | Full sidebar; dashboard 12-col grid (as reference) |
| `≥1440` | Max content width 1360, centered |

**Mobile rules:** touch targets ≥ 44 px; reduce blur to 12 px for performance; hide 3D banner animation; composer sticks above keyboard (`dvh` units).

## 9. Dashboard Mapping (reference → VaultChat)
| Reference | VaultChat |
|---|---|
| Next game | Latest active conversation / "Resume chat" |
| Games statistic bar | Messages today: sent / received / expiring |
| Standings table | Recent conversations table (name, unread, last activity, expires) |
| Possession / Price / Budget / Score tiles | Active chats · Unread · Expiring < 1 h · Key status |
| "Setup training" banner | "Create a new group" / security tips banner (3D art) |
| Sidebar | Dashboard · Chats · Groups · Broadcasts · Settings · (Admin: Users · Audit · Security) |
