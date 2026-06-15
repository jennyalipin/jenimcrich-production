# Google Workspace Integration — Plan

Status: **planned, not built.** Decision record + build guide for connecting the
ATS to Google **Gmail, Calendar, Drive, and Sheets**. Nothing here is wired yet.
Calendar has its own detailed doc — see `docs/GOOGLE-CALENDAR-SYNC.md`; this doc
covers the *cross-service* strategy and the Gmail/Drive/Sheets pieces.

---

## 0. TL;DR recommendation

Most of the "Workspace" wish list is **already met by lighter paths we've
shipped**, and the native Google APIs carry a real verification cost. Build in
this order, and skip what doesn't earn its keep:

| Service | Native-API value | Recommendation |
| ------- | ---------------- | -------------- |
| **Calendar** | High — real invites, Meet links, free/busy | ✅ **Build** (service account, per `GOOGLE-CALENDAR-SYNC.md`) |
| **Drive** | Medium — import résumés the owner keeps in Drive | ✅ **Build later** — Google Picker + `drive.file` (narrow scope, no security assessment) |
| **Gmail (sending)** | Low — personal Gmail is the wrong tool to send from | ❌ **Use Resend** instead (verified domain, deliverability, logging) |
| **Gmail (template import)** | Low — already covered | ❌ **Skip** — the paste/CSV template import is shipped |
| **Sheets** | Low — already covered | ❌ **Skip** — CSV import/export round-trips with Sheets already |

The rest of this doc explains *why*, and gives the build guide for the two we
should do (Drive now-ish, Calendar per its own doc).

---

## 1. The decision that drives everything: personal Gmail vs Workspace

The owner's account is **`jennyalipin06@gmail.com` — a personal `@gmail.com`,
not a Google Workspace domain.** This is decisive:

- **No domain-wide delegation.** A service account *cannot* silently read a
  personal Gmail mailbox or Drive. DWD only works on a Workspace domain whose
  admin authorizes the scopes.
- **Personal data ⇒ per-user OAuth.** To touch *her* Gmail/Drive/Sheets, she
  must click "Connect Google" and grant consent; we store a **refresh token**.
- **Shared, app-owned data ⇒ service account.** Anything the *app* owns (the
  interview calendar) can use a service account with no user consent. That's why
  Calendar is a service account and Gmail/Drive are OAuth — different access
  models, on purpose.

```
App-owned resource  → service account (Calendar: shared "JeniMcRich Interviews")
Owner's private data → per-user OAuth + stored refresh token (Gmail/Drive/Sheets)
```

### 1a. The OAuth verification reality (read before promising Gmail/Sheets)

Google tiers OAuth scopes:

- **Restricted** (`gmail.readonly`, `gmail.send`, broad `drive`/`spreadsheets`):
  require a **CASA security assessment** (paid, annual, weeks of work) to ship to
  users outside your own test list. Not worth it for a single-owner tool.
- **Sensitive** (`drive.file`, `calendar.events`): consent screen warning, but
  **no security assessment**. `drive.file` only exposes files the user picks or
  the app creates — narrow and shippable.
- **Non-sensitive**: trivial.

**Implication:** stay on `drive.file` (Picker-based) and avoid `gmail.*` and
broad `drive`/`sheets` scopes. For a true single-user need, an alternative is to
keep the OAuth app in **Testing** mode with the owner as the sole test user —
but Google expires refresh tokens after **7 days** in Testing mode, so anything
real must be **Published** (which forces the sensitive/restricted rules above).
This is the single biggest reason to prefer `drive.file` and skip Gmail/Sheets.

---

## 2. What we already shipped that covers the ask

Before building Google APIs, note these are **done** and cover most intent:

- **Sheets ⇄ candidates:** CSV **import** (`src/app/candidates/_components/import-button.tsx`
  + `_lib/import-actions.ts`) and **export** (`export-button.tsx`). Google Sheets
  exports/opens CSV natively, so "import my candidate spreadsheet" already works
  with zero OAuth — File → Download → CSV → drop in.
- **Gmail templates:** the **"Import from Gmail" paste flow** and template
  persistence (`src/app/templates/`) — copy a canned response, paste, it detects
  the `Subject:` line. No mailbox scope needed.
- **Sending email:** **Resend** is the planned path (templates + bulk composer
  with per-recipient preview are built; only "Send" is gated). Personal Gmail
  caps ~500 sends/day, has no merge/logging, and risks her account — Resend with
  a verified domain is strictly better.

So the *native* Google work worth doing is **Calendar** (its own doc) and
**Drive résumé import**. Everything below details Drive + the shared OAuth
plumbing; Gmail/Sheets are documented as "why not now".

---

## 3. Shared OAuth plumbing (needed for any per-user Google service)

One fresh **Google Cloud project** (the old one was deleted with Google
sign-in). Enable only the APIs you build (Drive first). Create an **OAuth 2.0
Web client**.

### 3a. Data model — store the connection

`supabase/migrations/00XX_google_connections.sql`:

```sql
create table public.google_connections (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  google_email   text not null,
  scopes         text[] not null,
  refresh_token  text not null,          -- encrypted at rest (see §5)
  access_token   text,                   -- short-lived cache
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (profile_id)
);
alter table public.google_connections enable row level security;
-- No SELECT policy for app roles: tokens are read only by the service role on
-- the server. Owner sees connection *status* via a view that omits the token.
```

### 3b. OAuth flow (server-side, offline access)

- `GET /api/google/connect` → redirect to Google consent with
  `access_type=offline&prompt=consent` and the **minimal** scope for the feature
  (`drive.file`). State param = CSRF token.
- `GET /api/google/callback` → exchange code → store `refresh_token` (encrypted)
  + `google_email` + `scopes` in `google_connections` via the **service-role**
  client. Never expose tokens to the browser.
- `POST /api/google/disconnect` → revoke at Google + delete the row.
- Token refresh: a server helper `getGoogleClient(profileId, scope)` loads the
  row (service role), refreshes the access token when `expires_at` is past,
  caches it. All Google calls are **server-only**.

### 3c. UI

A **"Connections"** card in Settings: "Connect Google" button → status
("Connected as jenny… · Disconnect"). Gated behind a `GOOGLE_OAUTH_ENABLED`
flag, off by default (matches the AI/Calendar pattern). Keep wording generic and
human — no scope/jargon dumps (per the Settings convention).

---

## 4. Drive — résumé / document import (the worthwhile per-user build)

**Use case:** the owner keeps candidate résumés in Drive; let her pull one onto a
candidate instead of downloading-then-uploading.

**Approach — Google Picker + `drive.file` (sensitive, no assessment):**

1. Client opens the **Google Picker** (the user selects the file → grants the app
   access to *only that file*, satisfying `drive.file`).
2. Server downloads the file via Drive API using the stored token, streams it
   into **Supabase Storage** (the existing private `documents` bucket, signed
   URLs), and inserts a `documents` row — reusing the current documents pipeline
   (`src/app/candidates/_components/documents-panel.tsx`). The file lands exactly
   where uploads do; the rest of the app is unchanged.
3. Optionally hand the downloaded résumé text to the existing AI résumé parser
   (`src/lib/ai/resume.ts`) to prefill skills/years.

**New module** `src/lib/google-drive.ts` (server-only): `downloadDriveFile(profileId, fileId)`
→ `{ buffer, name, mimeType }`. Hook point: a "Import from Drive" button beside
the existing upload control on the candidate **Documents** tab.

Scope: `https://www.googleapis.com/auth/drive.file` only.

---

## 5. Security

- **Tokens** in `google_connections`, written/read **only by the service role**
  on the server; never sent to the client. Encrypt `refresh_token` at rest
  (libsodium/`pgcrypto`, key in Doppler) — RLS alone isn't enough for a bearer
  credential.
- **Minimal scopes** (`drive.file`, `calendar.events`) — never `gmail.*` or broad
  `drive`/`spreadsheets` unless we accept the CASA assessment.
- **Fail-soft & flagged:** every integration behind its own `*_ENABLED` flag, off
  by default; Google outages must never block core ATS actions (mirror the
  Calendar doc's try/catch + soft-toast pattern).
- **PII:** never log candidate emails/phones or token values to console/Sentry.
- **Revocation:** disconnect revokes at Google *and* deletes the row.

---

## 6. Secrets (Doppler — never `.env`)

```
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI        # https://…/api/google/callback
GOOGLE_TOKEN_ENC_KEY             # for encrypting refresh tokens at rest
GOOGLE_OAUTH_ENABLED             # "true" feature flag — off = today's behavior
# Calendar (service account) keys live in GOOGLE-CALENDAR-SYNC.md
```

Add to Doppler (dev+prd) **and** Vercel manually — the Doppler→Vercel sync is not
automatic for new vars (same gotcha as the Vertex AI vars).

---

## 7. Phasing & effort

| Phase | Scope | Effort |
| ----- | ----- | ------ |
| **A** | Calendar (service account) — per `GOOGLE-CALENDAR-SYNC.md` | ~½–1 day |
| **B** | OAuth plumbing (§3) + Drive Picker import (§4) | ~1–1.5 days |
| **C** | Resend for real sending (separate from Google) | ~½ day + DNS |
| **—** | Gmail API / Sheets API | **deferred** — covered by paste/CSV; not worth the restricted-scope assessment |

**Bottom line:** build Calendar and (optionally) Drive natively; route *sending*
through Resend; keep using the shipped CSV/paste flows for Sheets and Gmail
templates. That gets ~90% of the Workspace value for ~10% of the OAuth-
verification pain.
```
