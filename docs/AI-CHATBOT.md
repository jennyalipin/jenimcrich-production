# AI Chatbot — Recruiter Copilot — Plan & Build

Status: **Level 1 (read-only copilot) built behind a flag — inert until Vertex
credentials are supplied.** Decision record + build guide. Powered by the same
Vertex/Gemini foundation as `docs/AI-INTEGRATION.md`.

## 0. What's built now

A **recruiter copilot**: a chat panel where Jenny asks questions in plain
language and gets answers **grounded in the live database via tool calls** (not
hallucinated). Read-only — it can look things up and draft text, but does not
mutate data yet.

New code:
- `src/lib/ai/tools.ts` — read-only AI tools wrapping the data layer
  (`search_candidates`, `stalled_candidates`, `list_jobs`,
  `rank_candidates_for_job`, `pipeline_summary`).
- `src/app/api/chat/route.ts` — streaming chat endpoint (`streamText` + tools),
  guarded by `isAIEnabled()` (returns 503 when AI is off).
- `src/components/assistant/Assistant.tsx` — slide-over chat UI (`useChat`).
- Topbar launcher button, shown only when `NEXT_PUBLIC_AI_ENABLED === "true"`.

**Default = OFF.** With the flags unset, no launcher renders and `/api/chat`
returns 503 — zero behavior change. Enable with the same Doppler secrets as the
resume scaffold (`AI_ENABLED`, `NEXT_PUBLIC_AI_ENABLED`, the four
`GOOGLE_VERTEX_*`), see `docs/AI-INTEGRATION.md §0`.

## 1. Why a copilot (not a generic bot)

The valuable AI surface for an ATS is a copilot **over your own data**:
- *"Who are my stalled candidates?"* → `stalled_candidates`
- *"Best matches for the Cement Plant Manager role?"* → `rank_candidates_for_job`
- *"Which candidates know kiln operations with 10+ years?"* → `search_candidates`
- *"How's the pipeline looking?"* → `pipeline_summary`

Tool calling is the grounding mechanism: the model can only answer from what the
tools return, so it can't invent candidates.

## 2. Architecture

```
useChat (Assistant.tsx, client)
   │  POST /api/chat   { messages: UIMessage[] }
   ▼
route.ts (server)
   ├─ isAIEnabled() guard → 503 if off
   ├─ streamText({ model: getVertexModel("fast"), system, tools,
   │               messages: convertToModelMessages(messages),
   │               stopWhen: isStepCount(5) })
   │     └─ tools execute server-side → call data layer (RLS-scoped to the
   │        logged-in recruiter via the request's Supabase session cookies)
   ▼
toUIMessageStreamResponse → streamed back to useChat
```

- **AI SDK v6**: `streamText` + `tool()` + `convertToModelMessages` +
  `createUIMessageStreamResponse`/`toUIMessageStream`; client `useChat` from
  `@ai-sdk/react` (manages messages; we own the input state and call
  `sendMessage({ text })`).
- **Model**: Gemini Flash (`getVertexModel("fast")`).
- **Multi-step**: `stopWhen: isStepCount(5)` so the model can call a tool, read
  the result, then answer.

## 3. Tools (read-only)

| Tool | Wraps | Returns (slim) |
| ---- | ----- | -------------- |
| `search_candidates` | `getCandidates({q,stages,tags,flagged_only})` | name, years, top skills, stages, flagged |
| `stalled_candidates` | `getStalledApplications()` | name, role, stage, days stalled |
| `list_jobs` | `getJobs({status})` | title, client, location, visa, applicants |
| `rank_candidates_for_job` | `getJobs` + `getCandidates` + `matchScore` | top-N candidates with score |
| `pipeline_summary` | `getDashboardStats()` | stage counts + key metrics |

Tool outputs are **slimmed and exclude email/phone** (PII minimization — the
model gets names + professional facts, not contact details). `matchScore` stays
the deterministic engine (domain rule 2); the tool just calls it.

## 4. Guardrails

- **Flag-gated** (`AI_ENABLED` server, `NEXT_PUBLIC_AI_ENABLED` client).
- **RLS-scoped**: tools run as the logged-in recruiter; no privilege escalation.
- **PII**: never log request/response bodies; contact details excluded from tool
  outputs; Vertex (paid) does not train on data.
- **Read-only**: no mutations in Level 1. Write-actions (move stage, log note,
  send email) come later **behind an explicit in-chat confirmation step** —
  never silent.
- **Honest-by-prompt**: the system prompt tells it to answer only from tools and
  say so when it doesn't know.

## 5. Later levels

- **L2 — write-actions with confirmation:** `move_candidate_stage`, `add_note`,
  `draft_and_send_email` — each returns a proposed action the user confirms in
  the chat before it executes (uses the existing server actions + activity log).
- **L3 — citations / deep links:** answers link to the candidate/job pages.
- **L4 — semantic recall:** embeddings (pgvector) so "find someone like X" works
  beyond keyword/skill overlap (ties into AI-INTEGRATION Level 5).

## 6. Checklist

- [x] Tools, route, UI, launcher built behind flags.
- [ ] Vertex creds in Doppler (see AI-INTEGRATION §3–4) to turn it on.
- [ ] Verify tool grounding once live (ask for stalled candidates, compare to board).
- [ ] L2 write-actions design review before enabling mutations.
