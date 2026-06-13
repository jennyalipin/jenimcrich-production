# Claude Code Prompt — Redesign the JeniMcRich Recruitment ATS UI

You are elevating the UI of **JeniMcRich Recruitment**, a recruitment/applicant-tracking
web app for a heavy-industry agency (cement, mining, aggregates, steel), including US roles
with TN-visa constraints. The product already works end-to-end on Next.js 16 (App Router) +
TypeScript + Tailwind CSS v4 + Supabase. **Your job is craft, not features:** take the existing
screens and make them feel like a premium, trustworthy B2B SaaS tool — calm, precise, quietly
editorial — without changing data, routes, or business logic.

**This document is the single source of truth for visual decisions.** When a token exists,
reference it — never hardcode a hex/px that duplicates one.

---

## 0) HARD RULES — never violate these (they override everything else)

1. **No emojis in the UI, ever.** Use the SVG `<Icon>` system (§7). Emojis are allowed only in
   conversational copy, never as icons, list markers, button glyphs, or status indicators.
2. **No square monogram logos** (e.g. "JM" letters in a rounded box). Use the crafted SVG
   `<LogoMark>` (§8). Initials-based *avatars* for individual users/candidates are fine.
3. **Never use any of these four patterns:**
   - **Fingernail borders** — accent-colored `border-l-4` / `border-l-[Npx]` strips on
     cards/rows/toasts/banners. Convey meaning with a badge, the ScorePill, a full ring,
     tonal surface, spacing, or dividers instead.
   - **All-caps + extreme letter-spacing** (≥ ~0.16em). Keep overlines small-caps with modest
     tracking (≤ 0.06em).
   - **"Live" pills / pulsing or glowing status dots.** Status must map to a real state and pair
     with a text label; dots are static.
   - **Purple / indigo / violet** anything — no aurora-glow blobs, no blue→purple "AI SaaS"
     gradient. The one accent that used to be violet (interview stage) is now **cyan**.

## The design language, in one paragraph
A "control-room ledger": a near-white slate canvas, white work surfaces, **one** confident action
color (**emerald**), and status tints that live only inside chips — never as section backgrounds.
Soft, layered, slate-tinted shadows (never heavy gray drop shadows). Tight **6px** control radius;
surfaces step up to 10–14px. Typography is **TT Norms Pro** everywhere, with **Signifier** (serif)
reserved for the occasional editorial accent word. Motion is small and crisp — a 1px lift on hover,
~150–250ms, never bouncy. The data and interactions are the spectacle; the chrome is restrained.

---

## 1) Typefaces (licensed, self-hosted via `next/font/local`)

- **Sans / everything:** **TT Norms Pro** (variable cut) → CSS var `--font-sans`. Weights used:
  400 body, 500 medium, 600 semibold, 650 headings, 700–800 brand.
- **Serif accent:** **Signifier** (Regular / Italic / Medium) → CSS var `--font-serif`. Use
  *sparingly* — one italic word in a hero/section heading, set via the `serif-accent` utility.
- Mono (rare, for `{{merge_field}}` chips / kbd): system mono via `--font-mono`.

Files live in `src/app/fonts/` and are wired in `src/app/layout.tsx`. Don't swap them.

---

## 2) Design tokens — Tailwind v4 `@theme` (in `src/app/globals.css`)

```css
/* Surfaces & chrome */
--color-canvas:  #f8fafc;  /* page background (slate-50) */
--color-surface: #ffffff;  /* cards, tables, modals */
--color-sidebar: #0f172a;  /* dark slate chassis (slate-900) */
--color-sidebar-line: #334155;
--color-ink:     #0f172a;  /* headings */

/* Primary action — EMERALD (the only brand color) */
--color-primary:        #059669;
--color-primary-strong: #047857;
--color-primary-soft:   #d1fae5;
--color-primary-faint:  #ecfdf5;
--color-primary-ink:    #065f46;

/* Status (chips only) */
--color-warning: #f59e0b;  --color-warning-soft: #fef3c7;  --color-warning-ink: #92400e;
--color-danger:  #ef4444;  --color-danger-soft:  #fee2e2;  --color-danger-ink:  #991b1b;
--color-info:    #3b82f6;  --color-info-soft:    #dbeafe;  --color-info-ink:    #1e40af;

/* Accent — CYAN (interview/technical; deliberately NOT violet) */
--color-accent:      #0891b2;  --color-accent-soft: #cffafe;  --color-accent-ink: #155e75;

/* Radii — tight controls, surfaces step up */
--radius-control: 0.375rem; /* 6px — buttons, inputs, chips */
--radius-card:    0.625rem; /* 10px — cards, tables */
--radius-modal:   0.875rem; /* 14px — dialogs */

/* Shadows — soft, layered, neutral-cool (slate-tinted) */
--shadow-card:    /* resting card: hairline ring + 3 stacked low-opacity layers */;
--shadow-raised:  /* hover/elevated card */;
--shadow-overlay: /* modals, toasts, popovers */;
--shadow-focus:       0 0 0 3px rgb(5 150 105 / 0.18);  /* emerald focus halo */
--shadow-input-inset: inset 0 1px 2px rgb(15 23 42 / 0.06); /* recessed field */

/* Motion */
--animate-modal-in: 0.18s cubic-bezier(0.16, 1, 0.3, 1);
/* transitions: short 150ms, default 200–250ms; hover lift = translateY(-1px) */
```

Color scale rule: **one primary (emerald), one accent (cyan), one neutral (slate).** Most
chips/badges are neutral slate. Color reinforces hierarchy; **typography and spacing establish it.**

---

## 3) Typography rules

- **Body / UI:** TT Norms Pro, 14px base (this is a dense data tool), `line-height: 1.5`,
  color slate-800. Tables/metadata 12–13px.
- **Headings:** weight **650**, `letter-spacing: -0.022em`, `line-height: ~1.15` — use the
  `heading-tight` utility. Give each page **one** clear focal heading; real size jumps
  (e.g. 13/14/16/20/28). No timid scale where H1 ≈ body.
- **Eyebrow / section label** (signature): `eyebrow` utility — `font-variant: all-small-caps;
  letter-spacing: 0.06em; font-weight: 600; color: var(--color-primary)`. Use sparingly above a
  section heading. The neutral `micro-label` (uppercase 11px, 0.045em, slate-500) is for table
  headers / field labels — keep it neutral, not emerald.
- **Serif accent:** `serif-accent` utility (Signifier italic) for at most one word in a heading.
- **Secondary text** on white is **slate-500 minimum** (slate-400 fails WCAG AA — never use
  slate-400 for readable text on white).

---

## 4) Color & elevation usage

- App canvas = `--color-canvas`; work surfaces = white `Card`s. Status tints never become section
  backgrounds.
- **Semantic elevation:** 0 canvas → 1 resting card (`--shadow-card`) → 2 interactive/hover
  (`--shadow-raised`) → 3 modal/popover (`--shadow-overlay`). Shadow depth means layering, not
  decoration.
- **Cards only for actionable/selectable units.** No card-in-card-in-card. Inside a card use type
  hierarchy + dividers + spacing, not more cards.
- **Spacing is intentional and varied:** tight (4–8px) inside clusters, medium (12–16px) within
  sections, large (24–40px) between zones. Don't space everything uniformly.
- Score bands (match score): green ≥ 80, amber 60–79, red < 60 — shown via the `ScorePill`, not a
  card border.

---

## 5) Motion

- Animate **state changes** (sort, insert, stage move, navigate, modal open). UI rests when idle —
  no constant pulsing/shimmer/particles.
- Durations ~150 / 200 / 320ms. Buttons lift `translateY(-1px)` on hover, settle on active.
- **Honor `prefers-reduced-motion`** — disable transforms/transitions (already wired globally).

---

## 6) Components (build to these specs, in the repo's `@/components/ui` idiom)

All are typed, presentational, prop-driven. Reuse them — don't re-roll one-offs.

- **Button** — `rounded-control` (6px), font-semibold, `transition` includes transform,
  `hover:-translate-y-px active:translate-y-0`, `focus-visible:ring-[3px]`. Variants:
  - `primary`: solid emerald + inset top-highlight `inset 0 1px 0 rgb(255 255 255/.16)`,
    hover → `primary-strong`. **No gradient.**
  - `secondary`: dark slate-800 + inset highlight, hover → sidebar.
  - `ghost`: slate-300 border, transparent, hover slate-100.
  - `danger`: solid red + inset highlight.
  - Sizes `sm`/`md`; `loading` shows a Spinner + `aria-busy`; `block` for forms.
- **Input / Select / Textarea** (`controlClass`): full-width, slate-300 border, 6px radius,
  `--shadow-input-inset`, placeholder slate-400; **focus** → emerald border + emerald `ring-[3px]`,
  inset removed. Invalid (`aria-invalid`) flips to red.
- **Card** (`Card`, `CardHeader`, `CardTitle`, `CardBody`, `CardFooter`): white, `rounded-card`,
  `--shadow-card`; interactive cards may elevate to `--shadow-raised` on hover.
- **Badge** (`default | success | warning | danger | info | visa`): pill, `badgeBaseClass`,
  mostly neutral. `visa` renders a leading `<Icon name="visa">` for restrictive work-auth.
- **ScorePill**: 0–100 match score in band color (green/amber/red) with an `sr-only` "X out of 100".
- **StageBadge**: pipeline ramp slate → blue → **cyan** (interview) → amber → emerald; red = exit.
- **Modal**: portal dialog, focus-trapped, Escape + backdrop dismiss, body scroll locked, focus
  restored to the trigger on close, opens via `--animate-modal-in`.
- **Toast**: dark slate chip with a **leading status `<Icon>`** (success/alert/info) — no accent
  left-rail. Bottom-right, `aria-live`.
- **DataTable**: sortable headers, `scroll-shadow-x` edge hint when overflowing, slim slate
  scrollbar, neutral `micro-label` headers.
- **EmptyState**: quiet slate disc with an `<Icon>`, a fact title, a next-step hint, optional action
  Button. "An empty screen is an invitation to act."
- **Tabs**: accessible roving-tab pattern (used on the candidate detail).

---

## 7) Icon system — `<Icon>` only (NO emoji, NO raw lucide imports in pages)

Import from `@/components/ui`. One outline style, one stroke weight, `currentColor` (tint via text
color). Built on `lucide-react` behind a **semantic** wrapper so call sites stay domain-named.

```tsx
import { Icon } from "@/components/ui";
<Icon name="interview" size={16} className="text-slate-500" />
<Icon name="star" fill />                         {/* filled = active priority */}
<Icon name="visa" size={12} label="Restrictive visa" /> {/* label → exposed to AT */}
```

**Valid `name`s:** `dashboard, candidates, matchmaker, jobs, calendar, settings, stage, note,
email, doc, interview, tag, flag, scorecard, system, visa, stalled, warning, star, target, bolt,
clock, inbox, empty, archive, verified, bell, search, close, check, plus, trash, chevronRight,
chevronDown, info, alert, success, document`. Need a new concept? **Add it to the wrapper**
(`src/components/ui/icon.tsx`) — don't import lucide directly in a page.

---

## 8) Logo — crafted SVG, not a monogram

`<LogoMark>` is two ascending emerald chevron bands (upward movement / placement), no lettered box.
`<Logo onDark>` pairs the mark with the "JeniMc**Rich**" wordmark ("Rich" in the Signifier serif
accent, emerald). Use `LogoMark` alone on the collapsed sidebar rail and favicon; `Logo` with
wordmark on the expanded sidebar and login.

---

## 9) YOUR TASK ✏️ (edit this line for the specific screen)

> **Default:** sweep every screen (dashboard, candidates list + detail tabs, pipeline kanban,
> matchmaker, jobs list + detail, calendar, templates, analytics, settings, login) and elevate them
> to this system — apply the type scale + 650 headings, eyebrow labels where a section needs one,
> the layered card/hover shadows, 6px radii, refined Button/Input states, the `<Icon>` set, and one
> tasteful Signifier accent per major header. Tighten spacing rhythm and fix any slate-400-on-white
> contrast. **Change zero data, routes, or business logic.** Keep it "boring-but-crisp."

For a single screen, replace the above with e.g.: *"Redesign the candidate detail page — header,
the six tabs (Overview, Notes, Scorecards, Documents, Schedule, Activity), and the match panel."*

---

## 10) Engineering conventions

- **Tailwind CSS v4** with `@theme` tokens + `@utility` (this repo's idiom) — **not** plain
  CSS-variable files, **not** a component kit. Reference tokens via Tailwind classes
  (`bg-primary`, `text-slate-500`, `rounded-card`, `shadow-[var(--shadow-card)]`).
- Next.js **App Router**: Server Components by default; `"use client"` only where interaction needs
  it. No business logic in presentational components.
- TypeScript strict; no `any`. Accessibility: semantic HTML, visible `:focus-visible` rings,
  `aria-label` on icon-only buttons, labelled inputs, AA contrast, honor reduced-motion.
- Never hardcode a hex/px that duplicates a token. New values only for genuine one-off layout.

## 11) Definition of done
- [ ] Zero emojis; zero monogram logos; none of the four banned patterns; no violet/indigo/purple.
- [ ] TT Norms Pro applied to `body`; Signifier used for ≤ one accent word per major heading.
- [ ] Headings use the 650/-0.022em register with a real size scale; one focal heading per page.
- [ ] Cards use the layered resting shadow, elevate on hover where interactive; 6px control radius.
- [ ] All icons via `<Icon>`; all secondary-on-white text ≥ slate-500 (AA).
- [ ] Responsive to 360px; fully keyboard-navigable; `pnpm build`, `pnpm lint`, `pnpm typecheck`
      pass with no errors.

---
*JeniMcRich design system — emerald/slate "control-room ledger" elevated with Ashby-grade component
craft. Reflects the live implementation in `src/app/globals.css` and `src/components/ui`.*
