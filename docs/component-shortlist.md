# 21st.dev Component Shortlist — JeniMcRich ATS

Curated community components from [21st.dev](https://21st.dev/community/components) mapped to the screens in this app. All are Tailwind + shadcn-compatible, so they drop into our dark-slate / emerald theme with minor restyling.

**Install:** this machine uses pnpm (no npm). Run from the repo root:

```bash
pnpm dlx shadcn@latest add <registry-url>
```

(The 21st.dev install snippet shows `npx` — substitute `pnpm dlx`. The registry URL drops the variant suffix, e.g. `.../table/table-sortable` installs from `.../r/jollyshopland/table`.)

After install, components land in `src/components/ui/`. Restyle to the theme (`#0f172a` headers/sidebar, white cards, `#059669` emerald primary, amber warnings) and keep business logic in our own server actions — do not carry over any prototype `localStorage` habits.

---

## Pipeline board (Kanban) — `src/app/pipeline/`

Drag-and-drop board for Applied → Screening → Interview → Offer → Hired (+ Rejected). The haydenbleasel option already uses `@dnd-kit/core` (our chosen DnD lib) and renders owner avatars + dates per card — closest fit to our card design.

**Kanban — haydenbleasel** _(top pick; pairs with the data table below)_
```bash
pnpm dlx shadcn@latest add https://21st.dev/r/haydenbleasel/kanban
```
- Page: https://21st.dev/community/components/haydenbleasel/kanban/default
- Deps: `@dnd-kit/core`, `date-fns`, `tailwindcss`

**Kanban — reui**
```bash
pnpm dlx shadcn@latest add https://21st.dev/r/reui/kanban
```
- Page: https://21st.dev/community/components/reui/kanban/default

**Kanban Board — arihantcodes**
```bash
pnpm dlx shadcn@latest add https://21st.dev/r/arihantcodes_1f7b8c4d/kanban-board
```
- Page: https://21st.dev/community/components/arihantcodes_1f7b8c4d/kanban-board/default

---

## Candidate & job lists (Tables) — `src/app/candidates/`, `src/app/jobs/`

Sortable, filterable, paginated tables for candidate and job lists.

**Data Table — shadcn** _(top pick; built-in sorting/filtering/pagination)_
```bash
pnpm dlx shadcn@latest add https://21st.dev/r/shadcn/data-table
```
- Page: https://21st.dev/community/components/shadcn/data-table/default

**Table — haydenbleasel** _(visually consistent with the haydenbleasel kanban)_
```bash
pnpm dlx shadcn@latest add https://21st.dev/r/haydenbleasel/data-table
```
- Page: https://21st.dev/community/components/haydenbleasel/data-table/default

**Sortable Table — jollyshopland**
```bash
pnpm dlx shadcn@latest add https://21st.dev/r/jollyshopland/table
```
- Page: https://21st.dev/community/components/jollyshopland/table/table-sortable

---

## Score pills & visa badges (Badges) — shared `src/components/`

Adapt the color variants for `ScorePill` (green ≥80 / amber 60–79 / red <60) and the restrictive-visa 🛂 badge.

**Marketing Badges — jatin-yadav05**
```bash
pnpm dlx shadcn@latest add https://21st.dev/r/jatin-yadav05/marketing-badges
```
- Page: https://21st.dev/community/components/jatin-yadav05/marketing-badges/default

---

## Interview scheduling (Calendars) — `src/app/calendar/`

Slot-based scheduling; must prevent double-booking an interviewer's slot (enforce in our logic, not the component).

**Calendar Planner — ruixenui** _(top pick; planner layout suits interview slots)_
```bash
pnpm dlx shadcn@latest add https://21st.dev/r/ruixenui/calendar-planner
```
- Page: https://21st.dev/community/components/ruixenui/calendar-planner/default

**Calendar — aliimam**
```bash
pnpm dlx shadcn@latest add https://21st.dev/r/aliimam/calendar
```
- Page: https://21st.dev/community/components/aliimam/calendar/default

---

## Resume / document upload (File Uploads) — candidate Documents tab

Drag-drop upload feeding Supabase Storage (private bucket, signed URLs).

**Multi-file Dropzone — ephraimduncan** _(top pick; drag-drop, multiple files)_
```bash
pnpm dlx shadcn@latest add https://21st.dev/r/ephraimduncan/file-upload-1
```
- Page: https://21st.dev/community/components/ephraimduncan/file-upload-1/multi-file-dropzone

**File Upload (table + avatar variants) — anubra266**
```bash
pnpm dlx shadcn@latest add https://21st.dev/r/anubra266/file-upload-1
```
- Files-table page: https://21st.dev/community/components/anubra266/file-upload-1/files-table-upload
- Avatar-upload page: https://21st.dev/community/components/anubra266/file-upload-1/avatar-upload

---

## App shell (Sidebar) — root layout

Collapsible nav; show/hide items by role (admin / recruiter / hiring_manager).

**Sidebar — shadcn**
```bash
pnpm dlx shadcn@latest add https://21st.dev/r/shadcn/sidebar
```
- Page: https://21st.dev/community/components/shadcn/sidebar/default

---

## Candidate detail tabs (Tabs) — `src/app/candidates/[id]/`

Overview / Notes / Scorecards / Documents / Schedule / Activity.

**Tabs (with line) — originui**
```bash
pnpm dlx shadcn@latest add https://21st.dev/r/originui/tabs
```
- Page: https://21st.dev/community/components/originui/tabs/with-line

---

## Modals, forms & selects — add candidate, JD entry, bulk-email preview

**Dialog — efferd**
```bash
pnpm dlx shadcn@latest add https://21st.dev/r/efferd/dialog
```
- Page: https://21st.dev/community/components/efferd/dialog/default

**Multistep Form — jatin-yadav05** _(good for new-candidate intake)_
```bash
pnpm dlx shadcn@latest add https://21st.dev/r/jatin-yadav05/multistep-form
```
- Page: https://21st.dev/community/components/jatin-yadav05/multistep-form/default

**Select — anubra266** _(visa enum, stage, filters)_
```bash
pnpm dlx shadcn@latest add https://21st.dev/r/anubra266/select-1
```
- Page: https://21st.dev/community/components/anubra266/select-1/default

---

_Compiled from 21st.dev community components, June 2026. Verify each component's license and dependencies before adding to the build (`pnpm build`, `pnpm lint`, `pnpm typecheck` must pass)._
