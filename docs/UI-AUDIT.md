# UI Audit — Jenny Mcrich Recruitment ATS

Date: 2026-06-14. Extensive audit across every page + the shell + cross-cutting
themes (design system, iconography, accessibility, responsive/long-data,
consistency). Items marked **[fixing now]** are being addressed this pass; the
rest are a prioritized backlog.

## Executive summary

The app is well-built and largely design-system compliant (emerald/slate, white
cards, no emoji, no aurora gradients, good empty states, solid a11y foundations).
The audit found a cluster of **chrome/consistency issues** worth fixing now, plus
a backlog of **per-page polish**.

## High priority — [fixing now]

1. **Sidebar "Supabase connected" status** — dev-only signal, meaningless to a
   non-technical owner. Remove. `shell/Sidebar.tsx`.
2. **Iconography: 3 icon styles** — `Icon` (lucide, stroke 2), `NavSvg`
   (sidebar, stroke 1.8), `TopSvg` (topbar, stroke 1.8). The search-bar icon
   doesn't match the nav. Unify everything onto the `Icon` component.
   `shell/Sidebar.tsx`, `shell/Topbar.tsx`.
3. **Hardcoded notifications** — `DEMO_NOTIFICATIONS` array. Wire to real data
   (stalled candidates + today's interviews) with an honest empty state.
   `shell/Topbar.tsx`.
4. **Analytics blue charts** — `time-in-stage-chart.tsx` fills `#3b82f6`;
   `charts/theme.ts` uses blue for screening + a source colour. Replace with
   brand-aligned (emerald/teal/amber) — no pure blue. `components/charts/*`.
5. **Dashboard long lists** — stalled table + activity feed are unbounded; with
   70 candidates the page scrolls forever. Cap to ~8 with a "view all" affordance.
   `dashboard/page.tsx`.
6. **Pipeline trailing whitespace** — board scroll container lacks right padding,
   so the last column sits flush against dead space on far-right scroll. Add
   `pr` to the flex row. `pipeline/pipeline-board.tsx`.
7. **Aurora avatar + ALL-CAPS role** — Topbar user avatar uses an emerald→teal
   gradient (banned); role renders "ADMIN" with tracking. Solid emerald + "Admin".
   `shell/Topbar.tsx`.

## Backlog — per-page polish (not yet done)

### Settings
- Hide/trim the "Production roadmap" card (signals "unfinished" to the owner).
- Make the demo-workspace notice a prominent amber banner, not inline text.
- Roles table: tint the header row, spell out "Hiring Manager".

### Templates
- Surface merge-fields more prominently ("Personalize with: {{candidate_name}}…").
- Disabled "Bulk email": add a tooltip explaining why; promote the Resend notice.
- Expand template-body preview height; add fade-out overflow.

### Calendar
- Roomier month cells (`min-h-28`), slightly larger chips, `leading-tight`.
- Standardize event-chip radius `rounded-[5px]` → `rounded-control`.
- Clearer "This week" header (two-line date range).

### Matchmaker
- Consolidate "Cons" + "Skill gaps" labels.
- Real progress bar (1/5…5/5) during analysis instead of a generic spinner.
- Score-breakdown table: alternating rows, more padding.

### Candidates / Jobs
- Candidates table: hide low-priority columns below `lg`; consider pagination >100.
- Candidate detail: `lg:grid-cols-[1.2fr_0.8fr]` overview; "Download resume" affordance.
- Job detail: KPI grid `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`; legend dots
  on the mini-pipeline; back-link uses an Icon chevron.
- Jobs table: "Days open" full words; skill-preview `title` tooltip.

### Login
- Watermark logomark too faint (`opacity-[0.06]` → `opacity-10`).
- Reconsider the all-small-caps eyebrow; soften "Secured by Supabase Auth" copy.
- Add a "Forgot password?" affordance (even if "contact support").

## Cross-cutting backlog
- **Radius drift**: shadcn popovers/tooltips/modals use `rounded-md/lg` vs the
  brand `rounded-card` (10px). Align via the radius tokens.
- **`--color-info: #3b82f6`** (blue) drives the Screening stage badge. The
  pipeline heat-ramp is documented, but consider a teal to stay on-brand.
- **Match-card** mixes a unicode `✓` with `<Icon name="close">`; use Icon for both.
- **A11y**: spot-check focus-visible on all form controls; pipeline cards could
  show a clearer keyboard-drag affordance.
