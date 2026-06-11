# JeniMcRich Recruitment Platform

Production build of the JeniMcRich recruitment/ATS app. The validated prototype lives at
`prototype/JeniMcRich-Recruitment-App.html` — it is the UX reference for everything built here.

## Documents in this folder

| File | Purpose |
|---|---|
| `CLAUDE.md` | Instructions Claude Code reads automatically — stack, conventions, domain rules |
| `docs/PRD.md` | Full product requirements with P0/P1/P2 priorities |
| `docs/MVP.md` | The v1 cut line + launch checklist |
| `docs/ARCHITECTURE.md` | Stack, data model, RLS, integrations |
| `docs/ROADMAP.md` | Build phases |
| `.env.example` | Required environment variables (copy to `.env.local`, fill in) |

## How to start building with Claude Code

1. Install prerequisites: Node.js 20+, git, and Claude Code (`npm install -g @anthropic-ai/claude-code`).
2. Open a terminal in this folder and run `claude`.
3. Good first prompts, in order:
   - "Read CLAUDE.md and docs/, then scaffold the Next.js project per Phase 1 of the roadmap."
   - "Create the Supabase migrations for the data model in docs/ARCHITECTURE.md, including the RLS policies and the interview double-booking constraint."
   - "Port the matchScore function from prototype/JeniMcRich-Recruitment-App.html into src/lib/scoring.ts with unit tests."
4. Work phase by phase (see `docs/ROADMAP.md`). Don't let any session skip the launch checklist in `docs/MVP.md`.

## Accounts you'll need (all have free tiers)

- **Supabase** — database, auth, file storage (create two projects: staging + production)
- **Resend** — transactional email (needs DNS records on your sending domain)
- **Vercel** — hosting (connect the git repo)
- **GitHub** — code hosting / backups

## Rules of the road

- Never commit `.env.local` or any API keys.
- Every schema change is a migration file — no clicking around the Supabase dashboard for structure.
- The prototype decides UX disputes; the PRD decides scope disputes; the MVP doc decides "now or later" disputes.
