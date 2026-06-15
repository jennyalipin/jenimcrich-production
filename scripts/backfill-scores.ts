/**
 * One-time backfill of applications.match_score using the canonical scoring
 * engine (domain rule 2). Run with: doppler run -- pnpm dlx tsx scripts/backfill-scores.ts
 * Re-runnable (idempotent — recomputes every application).
 */
import { createClient } from "@supabase/supabase-js";
import { matchScore } from "../src/lib/scoring";
import type { CandidateSkill, JobSkill } from "../src/lib/data/types";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const clampWeight = (n: number): 1 | 2 | 3 => (n <= 1 ? 1 : n >= 3 ? 3 : 2);

async function main() {
const [apps, cands, cskills, ccerts, jobs, jskills] = await Promise.all([
  db.from("applications").select("id, candidate_id, job_id"),
  db.from("candidates").select("id, full_name, years_exp"),
  db.from("candidate_skills").select("candidate_id, skill, years"),
  db.from("candidate_certifications").select("candidate_id, name"),
  db.from("jobs").select("id, min_years"),
  db.from("job_skills").select("job_id, skill, weight"),
]);

const skByCand = new Map<string, CandidateSkill[]>();
for (const r of cskills.data ?? []) {
  const l = skByCand.get(r.candidate_id) ?? [];
  l.push({ skill: r.skill, years: r.years });
  skByCand.set(r.candidate_id, l);
}
const certByCand = new Map<string, string[]>();
for (const r of ccerts.data ?? []) {
  const l = certByCand.get(r.candidate_id) ?? [];
  l.push(r.name);
  certByCand.set(r.candidate_id, l);
}
const skByJob = new Map<string, JobSkill[]>();
for (const r of jskills.data ?? []) {
  const l = skByJob.get(r.job_id) ?? [];
  l.push({ skill: r.skill, weight: clampWeight(r.weight) });
  skByJob.set(r.job_id, l);
}
const candById = new Map((cands.data ?? []).map((c) => [c.id, c]));
const jobById = new Map((jobs.data ?? []).map((j) => [j.id, j]));

let updated = 0;
for (const a of apps.data ?? []) {
  const c = candById.get(a.candidate_id);
  const j = jobById.get(a.job_id);
  if (!c || !j) continue;
  const score = matchScore(
    {
      name: c.full_name,
      yearsExp: c.years_exp,
      skills: skByCand.get(c.id) ?? [],
      certifications: certByCand.get(c.id) ?? [],
    },
    { minYears: j.min_years, skills: skByJob.get(j.id) ?? [] },
  ).score;
  const { error } = await db
    .from("applications")
    .update({ match_score: score, scored_at: new Date().toISOString() })
    .eq("id", a.id);
  if (error) {
    console.error("update failed:", error.message);
    break;
  }
  updated++;
}
console.log(`Backfilled match_score for ${updated} applications.`);
}

main().catch((e) => {
  console.error("Backfill failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
