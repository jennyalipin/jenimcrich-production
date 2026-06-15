/**
 * Seed 50 demo candidates into Supabase (heavy-industry: cement / mining /
 * aggregates / steel; PH-based plus TN-visa Canadian/Mexican applicants).
 *
 * Runs with the service-role key (bypasses RLS). The applications AFTER INSERT
 * trigger writes "Application received via …" activity automatically.
 *
 *   doppler run -- node scripts/seed-demo-candidates.mjs
 *
 * Candidate skills are sampled from each target job's real skill vocabulary so
 * match scores are meaningful. Re-running creates NEW rows (emails carry a
 * unique suffix) — it is additive, not idempotent.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (run via `doppler run --`).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const COUNT = 50;
const EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "icloud.com", "proton.me"];
const usedEmails = new Set(); // realistic, collision-free emails within a run

/* ---------------- random helpers ---------------- */
const rand = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rand(a.length)];
const chance = (p) => Math.random() < p;
const randInt = (a, b) => a + rand(b - a + 1);
function sample(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(rand(copy.length), 1)[0]);
  return out;
}
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of pairs) if ((r -= w) < 0) return v;
  return pairs[0][0];
};
const slug = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/gi, "").toLowerCase();
const daysAgoISO = (d) => new Date(Date.now() - d * 86_400_000).toISOString();

/* ---------------- name + place pools ---------------- */
const PH_FIRST = ["Juan","Jose","Antonio","Ramon","Ricardo","Eduardo","Manuel","Carlos","Roberto","Andres","Felipe","Mateo","Miguel","Rafael","Emmanuel","Joel","Noel","Arnel","Reynaldo","Rolando","Edgar","Allan","Dennis","Marvin","Jerome","Christian","Jayson","Mark","Kevin","Aldrin","Maria","Ana","Rosa","Cristina","Liza","Grace","Joy","Divine","Angeline","Jocelyn","Catherine","Sharon","Daisy","Lorna","Melinda","Nora","Precious","Mhel","Aira","Kristine"];
const PH_LAST = ["Santos","Reyes","Cruz","Bautista","Garcia","Mendoza","Torres","Flores","Villanueva","Ramos","Gonzales","Castillo","Ramirez","Aquino","Diaz","Domingo","Fernandez","Salazar","Pascual","Mercado","Aguilar","Navarro","Soriano","Manalo","Tolentino","Macaraeg","Pangilinan","Dela Cruz","Gatchalian","Lumibao"];
const PH_CITY = ["Cebu City","Davao City","Quezon City","Iloilo City","Cagayan de Oro","Bacolod","General Santos","Batangas City","Cement, Bulacan","Toledo, Cebu"];
const CA = { first: ["Liam","Olivia","Noah","Emma","William","Ethan","Logan","Charlotte"], last: ["Tremblay","Roy","Gagnon","Bouchard","Côté","Morin","Pelletier","Gauthier"], city: ["Calgary, AB","Edmonton, AB","Sudbury, ON","Hamilton, ON"] };
const MX = { first: ["Santiago","Valentina","Mateo","Sofía","Diego","Camila","Emiliano","Regina"], last: ["Hernández","Ramírez","González","Martínez","López","Torres","Flores","Reyes"], city: ["Monterrey, NL","Hermosillo, SON","Saltillo, COAH","Torreón, COAH"] };
const US = { first: ["James","Emily","Michael","Ashley","David","Jessica","Robert","Amanda"], last: ["Miller","Johnson","Anderson","Thompson","Wilson","Carter","Brooks","Hughes"], city: ["Pittsburgh, PA","Birmingham, AL","Gary, IN","Houston, TX"] };

const GENERIC_SKILLS = ["Plant Operations","Maintenance & Reliability","HSE Management","Production Planning","Heavy Equipment Operation","SAP PM","Electrical Maintenance","Mechanical Maintenance","Continuous Improvement","Root Cause Analysis","Budget Management","Team Leadership","Shift Supervision","Preventive Maintenance"];
const CERTS = ["ISO 9001 Lead Auditor","Six Sigma Black Belt","Six Sigma Green Belt","Lean Six Sigma","CMRP","PMP","PE License","NEBOSH IGC","OSHA 30","MSHA Part 48","First Aid & CPR","Licensed Blaster","Certified Welding Inspector"];
const TAGS = ["priority","passive","relocating","referred","bilingual","union","night-shift OK","expat experience"];
const SOURCES = [["linkedin",6],["referral",4],["job_portal",3],["indeed",3],["agency",2],["other",1]];
const NOTICE = ["Immediate","2 weeks","30 days","60 days","90 days"];
const TITLES = ["Plant Manager","Production Supervisor","Maintenance Engineer","Reliability Engineer","Process Engineer","Kiln Operator","Mill Supervisor","Quarry Manager","HSE Officer","Mine Planner","Metallurgist","Quality Engineer","Operations Lead","Shift Engineer","Mechanical Supervisor"];

function person(nat) {
  if (nat === "CA") return { first: pick(CA.first), last: pick(CA.last), city: pick(CA.city) };
  if (nat === "MX") return { first: pick(MX.first), last: pick(MX.last), city: pick(MX.city) };
  if (nat === "US") return { first: pick(US.first), last: pick(US.last), city: pick(US.city) };
  return { first: pick(PH_FIRST), last: pick(PH_LAST), city: pick(PH_CITY) };
}
function salaryFor(nat) {
  if (nat === "PH") return pick(["₱45,000–₱65,000 / mo","₱70,000–₱95,000 / mo","₱100,000–₱140,000 / mo"]);
  if (nat === "CA") return pick(["CAD 95k–120k","CAD 110k–135k"]);
  if (nat === "MX") return pick(["USD 70k–95k","MXN 80k–110k / mo"]);
  return pick(["USD 90k–120k","USD 110k–140k"]);
}

/* ---------------- visa eligibility ---------------- */
// Which nationalities each job's visa rule admits.
function eligible(nat, visa) {
  switch (visa) {
    case "TN_CANADIAN_ONLY": return nat === "CA";
    case "TN_CANADIAN_OR_MEXICAN": return nat === "CA" || nat === "MX";
    case "US_CITIZEN_GC_ONLY": return nat === "US";
    case "H1B_TRANSFER": return nat !== "PH"; // already in US on a visa
    default: return true; // LOCAL, SPONSORSHIP_AVAILABLE, UNSPECIFIED
  }
}

async function main() {
  /* Fetch real jobs + their skill vocabulary so candidate skills overlap. */
  const [{ data: jobs, error: jErr }, { data: jobSkills, error: sErr }] = await Promise.all([
    db.from("jobs").select("id, title, visa, status"),
    db.from("job_skills").select("job_id, skill"),
  ]);
  if (jErr || sErr) throw jErr ?? sErr;
  const skillsByJob = new Map();
  for (const r of jobSkills) {
    const list = skillsByJob.get(r.job_id) ?? [];
    list.push(r.skill);
    skillsByJob.set(r.job_id, list);
  }
  const openJobs = jobs.filter((j) => j.status !== "closed");
  if (openJobs.length === 0) throw new Error("No jobs to apply candidates to — seed jobs first.");

  /* Build the 50 candidates. */
  const candRows = [];
  const meta = []; // parallel: { nat, primaryJob, secondaryJob, skills, certs, tags }
  for (let i = 0; i < COUNT; i++) {
    const nat = weighted([["PH", 42], ["CA", 4], ["MX", 2], ["US", 2]]);
    const p = person(nat);
    const title = pick(TITLES);
    const years = randInt(3, 28);
    // Clean, realistic email: first.last@domain; append a number only on collision.
    const base = `${slug(p.first)}.${slug(p.last)}`;
    const dom = EMAIL_DOMAINS[i % EMAIL_DOMAINS.length];
    let email = `${base}@${dom}`;
    let dup = 1;
    while (usedEmails.has(email)) email = `${base}${dup++}@${dom}`;
    usedEmails.add(email);

    // Pick a primary job this candidate is visa-eligible for.
    const eligibleJobs = openJobs.filter((j) => eligible(nat, j.visa));
    const primaryJob = eligibleJobs.length ? pick(eligibleJobs) : null;

    // Skills: sample from the primary job's vocabulary + a few generic ones.
    const jobVocab = primaryJob ? (skillsByJob.get(primaryJob.id) ?? []) : [];
    const chosen = new Set([...sample(jobVocab, Math.min(jobVocab.length, randInt(2, 4))), ...sample(GENERIC_SKILLS, randInt(2, 3))]);
    const skills = [...chosen].map((skill) => ({ skill, years: Math.min(years, randInt(2, years)) }));

    candRows.push({
      full_name: `${p.first} ${p.last}`,
      email,
      phone: nat === "PH" ? `+63 9${randInt(10, 99)} ${randInt(100, 999)} ${randInt(1000, 9999)}` : `+1 ${randInt(200, 989)} ${randInt(200, 999)} ${randInt(1000, 9999)}`,
      source: weighted(SOURCES),
      years_exp: years,
      summary: `${title} with ${years} years in heavy industry (${pick(["cement","mining","aggregates","steel"])}). ${pick(["Strong on plant uptime and reliability.","Track record cutting unplanned downtime.","Led HSE and continuous-improvement programs.","Experienced across commissioning and ramp-up."])}`,
      expected_salary: salaryFor(nat),
      notice_period: pick(NOTICE),
      resume_text: `${p.first} ${p.last}\n${title} — ${years} years experience\nBased in ${p.city}.\nSkills: ${skills.map((s) => s.skill).join(", ")}.`,
      location: p.city,
      flagged: chance(0.16),
    });
    meta.push({
      nat,
      primaryJob,
      secondaryJob: chance(0.32) && eligibleJobs.length > 1 ? pick(eligibleJobs.filter((j) => j !== primaryJob)) : null,
      skills,
      certs: sample(CERTS, weighted([[0, 2], [1, 4], [2, 3], [3, 1]])),
      tags: sample(TAGS, weighted([[0, 4], [1, 4], [2, 2]])),
    });
  }

  /* Insert candidates, map back by email to get ids. */
  const { data: inserted, error: cErr } = await db.from("candidates").insert(candRows).select("id, email");
  if (cErr) throw cErr;
  const idByEmail = new Map(inserted.map((r) => [r.email, r.id]));

  /* Build child rows. */
  const skillRows = [], certRows = [], tagRows = [], appRows = [];
  const STAGES = [["applied", 30], ["screening", 24], ["interview", 18], ["offer", 8], ["hired", 10], ["rejected", 10]];
  for (let i = 0; i < COUNT; i++) {
    const id = idByEmail.get(candRows[i].email);
    const m = meta[i];
    for (const s of m.skills) skillRows.push({ candidate_id: id, skill: s.skill, years: s.years });
    for (const c of m.certs) certRows.push({ candidate_id: id, name: c });
    for (const t of m.tags) tagRows.push({ candidate_id: id, tag: t });
    for (const job of [m.primaryJob, m.secondaryJob]) {
      if (!job) continue;
      const stage = weighted(STAGES);
      // Realistic stalled rate: ~80% moved recently (0–4d), ~20% gone quiet
      // (5–22d) so only a credible minority trip the ≥5d stalled flag.
      const enteredDays = chance(0.2) ? randInt(5, 22) : randInt(0, 4);
      appRows.push({
        candidate_id: id,
        job_id: job.id,
        stage,
        stage_entered_at: daysAgoISO(enteredDays),
        applied_at: daysAgoISO(enteredDays + randInt(1, 20)),
      });
    }
  }

  /* Insert children (dedupe-safe via table unique constraints). */
  const ins = async (table, rows) => {
    if (!rows.length) return 0;
    const { error } = await db.from(table).insert(rows);
    if (error) throw new Error(`${table}: ${error.message}`);
    return rows.length;
  };
  const nSkills = await ins("candidate_skills", skillRows);
  const nCerts = await ins("candidate_certifications", certRows);
  const nTags = await ins("candidate_tags", tagRows);
  const nApps = await ins("applications", appRows);

  /* Summary. */
  const stageCounts = appRows.reduce((acc, a) => ((acc[a.stage] = (acc[a.stage] ?? 0) + 1), acc), {});
  console.log(`\n✓ Seeded ${inserted.length} candidates`);
  console.log(`  ${nSkills} skills · ${nCerts} certifications · ${nTags} tags`);
  console.log(`  ${nApps} applications →`, stageCounts);
  console.log(`  emails are clean first.last@domain (varied domains)`);
}

main().catch((e) => {
  console.error("Seed failed:", e.message ?? e);
  process.exit(1);
});
