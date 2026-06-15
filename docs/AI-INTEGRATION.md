# AI Integration — Implementation Plan

Status: **Level 1 (resume parsing) scaffolded behind a flag — pending Google
Cloud credentials.** Decision record + build guide for adding LLM features,
powered by **Google Cloud Vertex AI (Gemini)** under the `aiizelle@gmail.com`
account (existing credits). The Level 1 code path exists and is wired, but is
**OFF by default** and falls back to today's heuristics until the Vertex
service-account secrets (§3–§4) are supplied. Levels 2–5 remain unbuilt.

## 0. What's built now

**Level 1 (resume parsing) is scaffolded behind feature flags. Default = OFF —
with the flags unset the app behaves exactly as before (zero behavior change),
using the existing heuristic `parseResumeText()` from
`src/app/matchmaker/resume-parser.ts`.**

New code:

- `src/lib/ai/vertex.ts` — Vertex AI (`@ai-sdk/google-vertex`) provider built
  from the service-account secrets.
- `src/lib/ai/resume.ts` — `parseResumeWithAI(text, skillDictionary): Promise<ParsedResume>`.
  When `AI_ENABLED !== "true"` (the default) it returns **exactly** the heuristic
  `parseResumeText()` result; when enabled it calls Vertex and falls back to the
  heuristic on any error. Unit-tested in `src/lib/ai/resume.test.ts`.
- `src/lib/ai/index.ts` — barrel for the module's public surface.
- `src/app/matchmaker/ai-actions.ts` — server action that the matchmaker calls
  to parse a pasted/uploaded resume.
- Matchmaker UI wiring, gated by the public flag `NEXT_PUBLIC_AI_ENABLED`.

To **enable** (requires the Vertex service account from §3 — the gcloud steps to
create it are already documented there). Set these as Doppler secrets (never
`.env`):

```bash
doppler secrets set AI_ENABLED=true
doppler secrets set NEXT_PUBLIC_AI_ENABLED=true
doppler secrets set GOOGLE_VERTEX_PROJECT=jenimcrich-ai
doppler secrets set GOOGLE_VERTEX_LOCATION=us-central1
doppler secrets set GOOGLE_VERTEX_CLIENT_EMAIL=jenimcrich-ai-sa@jenimcrich-ai.iam.gserviceaccount.com
doppler secrets set GOOGLE_VERTEX_PRIVATE_KEY="$(cat key.json | jq -r .private_key)"
# Optional — pin model GA ids (defaults applied otherwise):
doppler secrets set AI_MODEL_FAST=<gemini-flash-ga-id>
doppler secrets set AI_MODEL_SMART=<gemini-pro-ga-id>
```

Two flags so the server (`AI_ENABLED`) and client (`NEXT_PUBLIC_AI_ENABLED`)
gate independently; flip both to fully turn Level 1 on. Either left unset keeps
the heuristic path. See §4 for the full secret list and §7 for PII handling.

## 1. Provider decision

**Vertex AI (Gemini) on Google Cloud**, billed to `aiizelle@gmail.com`'s
project/credits — chosen because the user owns the credits and wants the
gcloud-native path.

- **Access from code via the Vercel AI SDK** (`ai` + `@ai-sdk/google-vertex`).
  The SDK's `generateObject(... , { schema: zod })` gives **schema-validated
  structured output**, which fits this codebase's Zod-everywhere rule perfectly
  and makes resume/JD parsing reliable. It also keeps the provider swappable —
  if you ever want to route a feature to Claude or another model, it's a
  one-line provider change, not a rewrite. Default stays Gemini per your credits.
- **Why Vertex over the AI-Studio Gemini API key:** Vertex runs in *your* GCP
  project (your credits, your region, your data-governance), uses service-account
  auth that fits server-side Vercel, and **does not train on your prompts/data**
  on the paid tier — important because resumes are heavy PII (§7).

Models (pin the current GA version at build time):
- **Gemini Flash** — cheap/fast; resume + JD parsing, email drafts. The workhorse.
- **Gemini Pro** — match narratives / harder reasoning where quality matters.
- **Gemini embeddings** — semantic candidate↔job matching (Level 5).

## 2. Scope — ship in levels

| Level | Feature | Replaces / hooks | Priority |
| ----- | ------- | ---------------- | -------- |
| **1** | **Resume parsing** — PDF/text → structured candidate fields (skills+years, certs, summary, visa hints) | the heuristic `src/app/matchmaker/resume-parser.ts` + feeds candidate intake | ✅ flagship (called out in `CLAUDE.md`) |
| **2** | **JD parsing** — richer skill/visa/seniority extraction | augments `src/lib/jd-parser.ts` (`parseJD`) | high |
| **3** | **Match narrative** — generate the "edge" + pros/gaps prose | augments `scoring.ts` / `matchmaker/explain.ts` | medium |
| **4** | **Email draft assist** — personalized outreach/screening drafts | `src/lib/merge.ts` + templates flow | medium |
| **5** | **Semantic matching** — embeddings beyond keyword overlap | new, complements `matchScore` | later |

Detail below is for **Level 1**; 2–5 sketched.

> **Scoring stays deterministic.** `matchScore()` (domain rule 2) must remain a
> pure, unit-tested function. AI *feeds* it better structured inputs and *explains*
> results — it never replaces the score itself.

## 3. gcloud / Vertex setup (aiizelle@gmail.com)

```bash
gcloud auth login aiizelle@gmail.com           # or: gcloud config configurations create aiizelle
gcloud config set account aiizelle@gmail.com
gcloud projects create jenimcrich-ai --name="JeniMcRich AI"   # or reuse an existing project
gcloud config set project jenimcrich-ai
gcloud services enable aiplatform.googleapis.com               # Vertex AI
# Service account for the app (server-to-server, like the calendar plan):
gcloud iam service-accounts create jenimcrich-ai-sa
gcloud projects add-iam-policy-binding jenimcrich-ai \
  --member="serviceAccount:jenimcrich-ai-sa@jenimcrich-ai.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
gcloud iam service-accounts keys create key.json \
  --iam-account=jenimcrich-ai-sa@jenimcrich-ai.iam.gserviceaccount.com
```

Confirm billing/credits are attached to the project (Vertex requires billing
even while on free credits). Then **delete `key.json` from disk** after loading
its contents into Doppler.

## 4. Secrets (Doppler — never `.env`)

```
GOOGLE_VERTEX_PROJECT        # jenimcrich-ai
GOOGLE_VERTEX_LOCATION       # e.g. us-central1 (pick a region; see §7)
GOOGLE_VERTEX_CLIENT_EMAIL   # SA email
GOOGLE_VERTEX_PRIVATE_KEY    # PEM (literal \n, unescape at runtime)
AI_ENABLED                   # "true" feature flag — off = today's heuristics
AI_MODEL_FAST                # pinned Gemini Flash GA id
AI_MODEL_SMART               # pinned Gemini Pro GA id
```

`AI_ENABLED` off → the app uses the existing heuristic parsers exactly as today,
so the flag is a clean kill-switch and the heuristics stay as the offline
fallback.

## 5. Code architecture

**New module** `src/lib/ai/` (server-only):

```ts
// vertex.ts — builds the @ai-sdk/google-vertex client from SA secrets.
// resume.ts — parseResumeWithAI(file|text): Promise<ParsedResume>
// jd.ts      — parseJDWithAI(text): Promise<ParsedJD>      (Level 2)
// narrative.ts — explainMatch(candidate, job, score): Promise<{edge,pros,cons}> (L3)
// email.ts   — draftEmail(candidate, job, intent): Promise<string>  (L4)
// embed.ts   — embed(text): Promise<number[]>              (L5)
```

- Each function uses `generateObject` with the **same Zod schema the rest of the
  app already validates against** (e.g. `ParsedResume`, `ParsedJD`) so AI output
  is type-safe and can't poison the data layer.
- Keep functions **pure and Next-free**; call them from server actions.

### Level 1 wiring — resume parsing

1. **Input:** Gemini is multimodal — it can read an **uploaded PDF directly**, so
   we skip a separate text-extraction lib for PDFs (pasted text also supported).
   Resumes already land in the private Supabase Storage bucket
   (`candidate-documents`); pass the file (or a signed URL fetch) to Gemini.
2. **Extract → `ParsedResume`** (skills with years, certifications, total years,
   summary, visa/work-auth hints) via `generateObject` + the existing Zod schema.
3. **Reuse `detectVisa()`** from `jd-parser.ts` on the extracted text so visa
   classification stays one deterministic, tested code path.
4. **Human-in-the-loop:** show parsed fields **pre-filled and editable** in the
   intake wizard (`add-candidate-button.tsx`) / matchmaker — the recruiter
   confirms before save. AI never silently writes candidate records.
5. **Fallback:** on AI error/timeout or `AI_ENABLED=false`, fall back to the
   current `parseResumeText()` heuristic. AI is assistive, never blocking.

## 6. Failure handling & cost

- Wrap every model call in try/catch; on failure fall back to heuristics and
  show a soft toast ("Auto-fill unavailable — enter manually"). Never block the
  recruiter.
- Use **Flash** for the high-volume parsing paths; reserve **Pro** for narratives.
- Set token caps + timeouts; log token usage (not content) to watch credit burn.
- Optionally cache parses keyed by document hash to avoid re-parsing.

## 7. PII & data governance (important)

Resumes contain names, emails, phones, work history — heavy candidate PII.

- **Vertex AI (paid) does not use your prompts/responses to train models** and
  processes in your chosen region — pick `GOOGLE_VERTEX_LOCATION` deliberately
  (e.g. a region acceptable for the agency's data policy).
- Per `CLAUDE.md`: **never log candidate PII** to console/error trackers — that
  includes AI request/response bodies. Log token counts and IDs only.
- Resume files stay in the private bucket with signed URLs; don't send PII to any
  non-Vertex endpoint.
- Consider a one-line consent/notice that resumes are processed by an automated
  parser (good practice for candidate data).

## 8. Levels 2–5 (later)

- **2 JD parsing:** `parseJDWithAI` returns the existing `ParsedJD` shape; merge
  with `parseJD()` heuristics (AI fills gaps, heuristics as fallback).
- **3 Match narrative:** generate `edge`/pros/cons prose from the deterministic
  score + structured inputs; render on the candidate Overview "Match" card.
- **4 Email assist:** draft personalized screening/offer emails into the existing
  `{{merge}}` template flow; recruiter edits before send (sends already preview).
- **5 Semantic matching:** embed candidate skills + JD text, store vectors
  (pgvector in Supabase), use cosine similarity as an *additional* signal
  alongside `matchScore` — surfaced as "also consider," never overriding the
  weighted score.

## 9. Checklist

- [ ] `gcloud` switched to `aiizelle@gmail.com`; project + billing/credits ready.
- [ ] Vertex AI API enabled; service account + `aiplatform.user` role.
- [ ] Secrets in Doppler + Vercel; `AI_ENABLED` off by default.
- [ ] `src/lib/ai/` module with `@ai-sdk/google-vertex` + Zod `generateObject`.
- [ ] Level 1: PDF→`ParsedResume`, reuse `detectVisa`, editable pre-fill in intake.
- [ ] Heuristic parsers kept as fallback; AI never blocks manual entry.
- [ ] PII never logged; region chosen; scoring stays deterministic + tested.

## 10. Rough effort

Level 1 (Vertex setup + `src/lib/ai/resume.ts` + intake pre-fill, behind the
flag): ~1 day, mostly GCP setup + the structured-extraction module + the
review-before-save UI. The schemas already exist, which keeps the code small.
