/**
 * In-memory demo seed database for the JeniMcRich ATS.
 *
 * SERVER-ONLY. Pages must NEVER import this module directly — all access goes
 * through "@/lib/data" (index.ts), whose function signatures stay identical
 * when the store is swapped for Supabase queries.
 *
 * Properties of the seed:
 *  - Deterministic: every timestamp is built relative to REFERENCE_NOW
 *    (no `Date.now()`, no randomness) so SSR output is stable.
 *  - PII is clearly fake: all emails are @example.com / *.example.com and all
 *    phone numbers use the reserved 555-01xx fictional range.
 *  - Mirrors the prototype's seed (jobs j1–j6, candidates c1–c18, templates
 *    t1–t5) and extends it with US heavy-industry roles that exercise the
 *    visa enum (TN_CANADIAN_ONLY, TN_CANADIAN_OR_MEXICAN, US_CITIZEN_GC_ONLY,
 *    H1B_TRANSFER, SPONSORSHIP_AVAILABLE) plus steel-sector jobs.
 */

import { formatDateTime } from "@/lib/format";
import {
  REFERENCE_NOW_ISO,
  STAGE_LABELS,
  NOTE_CATEGORY_LABELS,
  RECOMMENDATION_LABELS,
  INTERVIEW_TYPE_LABELS,
  type ActivityLogEntry,
  type ActivityType,
  type Application,
  type Candidate,
  type Client,
  type DocumentCategory,
  type DocumentRecord,
  type EmailLogEntry,
  type EmailStatus,
  type EmailTemplate,
  type Interview,
  type Interviewer,
  type InterviewStatus,
  type InterviewType,
  type Job,
  type JobStatus,
  type Note,
  type NoteCategory,
  type Recommendation,
  type Scorecard,
  type Settings,
  type Source,
  type Stage,
  type TemplateCategory,
  type VisaType,
} from "./types";

/** Fixed reference instant all demo timestamps are relative to. */
export const REFERENCE_NOW = new Date(REFERENCE_NOW_ISO);

/* ------------------------------------------------------------------ */
/* Deterministic time helpers                                          */
/* ------------------------------------------------------------------ */

/** ISO instant `dayOffset` days from REFERENCE_NOW at `hh:mm` UTC. */
function at(dayOffset: number, time = "09:00"): string {
  const [h = 9, m = 0] = time.split(":").map(Number);
  const d = new Date(REFERENCE_NOW);
  d.setUTCHours(h, m, 0, 0);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d.toISOString();
}
const ago = (days: number, time?: string): string => at(-days, time);

/** Adds whole hours to an ISO instant (for derived event times). */
function plusHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 3_600_000).toISOString();
}

/* ------------------------------------------------------------------ */
/* Store shape                                                         */
/* ------------------------------------------------------------------ */

export interface DemoStore {
  clients: Client[];
  interviewers: Interviewer[];
  jobs: Job[];
  candidates: Candidate[];
  applications: Application[];
  notes: Note[];
  scorecards: Scorecard[];
  interviews: Interview[];
  documents: DocumentRecord[];
  templates: EmailTemplate[];
  email_log: EmailLogEntry[];
  activity_log: ActivityLogEntry[];
  settings: Settings;
  /** Monotonic counter for runtime-generated ids. */
  seq: number;
}

/* ------------------------------------------------------------------ */
/* Row factories (internal)                                            */
/* ------------------------------------------------------------------ */

/** "Brian O'Neal" → "brian.o.neal@example.com" — clearly fake. */
function fakeEmail(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z]+/g, ".")
      .replace(/^\.+|\.+$/g, "") + "@example.com"
  );
}

interface JobSeed {
  id: string;
  client_id: string;
  title: string;
  location: string;
  salary_range: string;
  min_years: number;
  status: JobStatus;
  visa: VisaType;
  visa_notes: string | null;
  opened_days_ago: number;
  skills: ReadonlyArray<readonly [string, 1 | 2 | 3]>;
  requirements: string[];
  description: string;
  jd_text: string;
}

interface CandidateSeed {
  id: string;
  name: string;
  location: string;
  phone: string;
  source: Source;
  years_exp: number;
  expected_salary: string;
  notice_period: string;
  skills: ReadonlyArray<readonly [string, number]>;
  certifications: readonly string[];
  summary: string;
  tags?: readonly string[];
  flagged?: boolean;
}

/** [id, candidate_id, job_id, stage, days_in_stage, days_since_applied] */
type AppSeed = readonly [string, string, string, Stage, number, number];

/** [id, candidate_id, author, category, body, days_ago] */
type NoteSeed = readonly [string, string, string, NoteCategory, string, number];

interface InterviewSeed {
  id: string;
  application_id: string;
  interviewer_id: string;
  /** Day offset from REFERENCE_NOW (negative = past). */
  day: number;
  time: string;
  type: InterviewType;
  status: InterviewStatus;
  booked_days_ago: number;
  duration_minutes?: number;
}

/** [id, application_id, interviewer_id, ratings, summary, rec, days_ago] */
type ScorecardSeed = readonly [
  string,
  string,
  string,
  Record<string, number>,
  string,
  Recommendation,
  number,
];

/** [id, candidate_id, file_name, category, days_ago] */
type DocSeed = readonly [string, string, string, DocumentCategory, number];

/** [id, candidate_id, template_id|null, subject, days_ago, status] */
type EmailSeed = readonly [string, string, string | null, string, number, EmailStatus];

/* ------------------------------------------------------------------ */
/* Seed definitions                                                    */
/* ------------------------------------------------------------------ */

const CLIENT_SEEDS: ReadonlyArray<Omit<Client, "created_at" | "updated_at">> = [
  { id: "cl1", name: "Helix Cement Corp", contact_name: "Liza Manalo", contact_email: "liza.manalo@helixcement.example.com", notes: "2.5 MTPA integrated cement plant in Cebu; expanding grinding capacity." },
  { id: "cl2", name: "Stonebridge Aggregates", contact_name: "Ramon Diaz", contact_email: "ramon.diaz@stonebridge.example.com", notes: "Three quarry sites in Rizal; 60-truck delivery fleet." },
  { id: "cl3", name: "Orion Mining Group", contact_name: "Carla Yulo", contact_email: "carla.yulo@orionmining.example.com", notes: "Nickel operations across Davao and Surigao sites." },
  { id: "cl4", name: "Lonestar Cement USA", contact_name: "Dale Whitfield", contact_email: "dale.whitfield@lonestarcement.example.com", notes: "Texas plant network; routinely hires Canadian engineers on TN status." },
  { id: "cl5", name: "Granite Peak Mining", contact_name: "Sandra Koch", contact_email: "sandra.koch@granitepeak.example.com", notes: "Open-pit gold operation near Elko, Nevada." },
  { id: "cl6", name: "Ironclad Steelworks", contact_name: "Tom Brennan", contact_email: "tom.brennan@ironcladsteel.example.com", notes: "EAF melt shop and rolling mill outside Pittsburgh, PA." },
];

const INTERVIEWERS: readonly Interviewer[] = [
  { id: "u1", name: "Jenny M.", role: "Principal Recruiter" },
  { id: "u2", name: "R. Santos", role: "Technical Recruiter" },
  { id: "u3", name: "C. dela Peña", role: "Client Account Manager" },
];

const JOB_SEEDS: readonly JobSeed[] = [
  {
    id: "j1", client_id: "cl1", title: "Plant Manager – Cement", location: "Cebu, PH",
    salary_range: "₱180k–240k/mo", min_years: 10, status: "open", visa: "LOCAL", visa_notes: null,
    opened_days_ago: 55,
    skills: [["Plant Operations", 3], ["Kiln Management", 3], ["Safety Compliance", 2], ["Team Leadership", 2], ["Budgeting", 1]],
    requirements: ["10+ yrs cement plant operations", "Kiln & pyro-processing expertise", "ISO 45001 safety leadership", "Managed 100+ headcount"],
    description: "Lead full plant P&L for a 2.5 MTPA cement line.",
    jd_text: "Plant Manager – Cement\nHelix Cement Corp · Cebu, Philippines\nCompensation: ₱180k–240k/mo\n\nLead full plant P&L for a 2.5 MTPA integrated cement line, owning production, maintenance, quality and safety.\n\nRequirements:\n- 10+ years in cement plant operations, with at least 5 in senior leadership\n- Deep kiln management and pyro-processing expertise\n- ISO 45001 safety leadership; zero-harm culture builder\n- Has managed 100+ headcount including contractors\n- Strong budgeting and cost-per-tonne discipline\n\nLocal role for Philippines-based candidates.",
  },
  {
    id: "j2", client_id: "cl2", title: "Quarry Supervisor – Aggregates", location: "Rizal, PH",
    salary_range: "₱90k–120k/mo", min_years: 6, status: "open", visa: "LOCAL", visa_notes: null,
    opened_days_ago: 48,
    skills: [["Quarry Operations", 3], ["Blasting", 3], ["Heavy Equipment", 2], ["Safety Compliance", 2], ["Production Planning", 1]],
    requirements: ["6+ yrs quarry supervision", "Licensed blaster preferred", "DENR/MGB compliance", "Fleet & crusher scheduling"],
    description: "Supervise drilling, blasting and crushing operations.",
    jd_text: "Quarry Supervisor – Aggregates\nStonebridge Aggregates · Rizal, Philippines\nCompensation: ₱90k–120k/mo\n\nSupervise the full drill–blast–crush cycle across two quarry benches.\n\nRequirements:\n- 6+ years quarry supervision in aggregates or mining\n- Licensed blaster strongly preferred\n- Working knowledge of DENR/MGB compliance\n- Fleet and crusher scheduling experience\n- Strong safety compliance record",
  },
  {
    id: "j3", client_id: "cl3", title: "Maintenance Reliability Engineer", location: "Davao, PH",
    salary_range: "₱110k–150k/mo", min_years: 5, status: "open", visa: "LOCAL", visa_notes: null,
    opened_days_ago: 41,
    skills: [["Reliability Engineering", 3], ["Predictive Maintenance", 3], ["SAP PM", 2], ["Root Cause Analysis", 2], ["Vibration Analysis", 2]],
    requirements: ["5+ yrs reliability in mining/heavy industry", "CMRP preferred", "Predictive maintenance program ownership", "SAP PM proficiency"],
    description: "Own asset reliability strategy for fixed & mobile plant.",
    jd_text: "Maintenance Reliability Engineer\nOrion Mining Group · Davao, Philippines\nCompensation: ₱110k–150k/mo\n\nOwn the asset reliability strategy for fixed and mobile plant at a nickel operation.\n\nRequirements:\n- 5+ years reliability engineering in mining or heavy industry\n- CMRP certification preferred\n- Has built and owned a predictive maintenance program\n- SAP PM proficiency; strong root cause analysis (RCA) discipline\n- Vibration analysis exposure is a plus",
  },
  {
    id: "j4", client_id: "cl3", title: "HSE Manager – Mining", location: "Surigao, PH",
    salary_range: "₱140k–180k/mo", min_years: 8, status: "open", visa: "LOCAL", visa_notes: null,
    opened_days_ago: 36,
    skills: [["Safety Compliance", 3], ["HSE Management", 3], ["Incident Investigation", 2], ["Training", 2], ["Audit", 1]],
    requirements: ["8+ yrs HSE in mining", "ISO 45001 lead auditor", "Fatality-prevention programs", "Regulatory liaison (DENR, DOLE)"],
    description: "Drive site-wide HSE strategy across two mine sites.",
    jd_text: "HSE Manager – Mining\nOrion Mining Group · Surigao, Philippines\nCompensation: ₱140k–180k/mo\n\nDrive site-wide HSE strategy across two mine sites with ~900 combined personnel.\n\nRequirements:\n- 8+ years HSE leadership in mining\n- ISO 45001 lead auditor certification\n- Designed and ran fatality-prevention programs\n- Incident investigation leadership (ICAM or equivalent)\n- Regulatory liaison experience with DENR and DOLE",
  },
  {
    id: "j5", client_id: "cl1", title: "Electrical Engineer – Plant", location: "Cebu, PH",
    salary_range: "₱80k–110k/mo", min_years: 4, status: "open", visa: "LOCAL", visa_notes: null,
    opened_days_ago: 30,
    skills: [["Electrical Systems", 3], ["PLC Programming", 2], ["Motor Control", 2], ["Power Distribution", 2], ["Safety Compliance", 1]],
    requirements: ["4+ yrs plant electrical", "PLC/SCADA exposure", "MV/LV distribution", "PEE/REE license"],
    description: "Maintain and improve plant electrical systems.",
    jd_text: "Electrical Engineer – Plant\nHelix Cement Corp · Cebu, Philippines\nCompensation: ₱80k–110k/mo\n\nMaintain and improve plant electrical systems across the kiln, mills and packhouse.\n\nRequirements:\n- 4+ years plant electrical engineering\n- PLC/SCADA exposure (Siemens or Allen-Bradley)\n- MV/LV power distribution experience\n- PEE or REE license required\n- Motor control and drives troubleshooting",
  },
  {
    id: "j6", client_id: "cl2", title: "Logistics Coordinator", location: "Rizal, PH",
    salary_range: "₱45k–60k/mo", min_years: 3, status: "on_hold", visa: "UNSPECIFIED", visa_notes: null,
    opened_days_ago: 25,
    skills: [["Logistics", 3], ["Dispatch", 2], ["ERP Systems", 2], ["Vendor Management", 1], ["Excel", 1]],
    requirements: ["3+ yrs logistics/dispatch", "Truck fleet coordination", "ERP literacy", "Strong Excel"],
    description: "Coordinate outbound aggregate dispatch & fleet.",
    jd_text: "Logistics Coordinator\nStonebridge Aggregates · Rizal, Philippines\nCompensation: ₱45k–60k/mo\n\nCoordinate outbound aggregate dispatch and a 60-truck delivery fleet.\n\nRequirements:\n- 3+ years logistics or dispatch experience\n- Truck fleet coordination and route scheduling\n- ERP literacy (SAP or similar)\n- Strong Excel; vendor management exposure",
  },
  {
    id: "j7", client_id: "cl4", title: "Process Engineer – Cement (US)", location: "Amarillo, TX, US",
    salary_range: "$95k–115k/yr", min_years: 5, status: "open", visa: "TN_CANADIAN_ONLY",
    visa_notes: "Client supports TN status for Canadian citizens only — site cannot process Mexican TN applicants.",
    opened_days_ago: 21,
    skills: [["Pyro Processing", 3], ["Process Optimization", 3], ["Kiln Management", 2], ["Quality Control", 2], ["Six Sigma", 1]],
    requirements: ["5+ yrs cement process engineering", "Preheater/kiln optimization wins", "Quality control systems", "Relocation to Texas Panhandle"],
    description: "Optimize pyro-processing and grinding circuits at a 1.2 MTPA US plant.",
    jd_text: "Process Engineer – Cement\nLonestar Cement USA · Amarillo, Texas\nCompensation: $95k–115k/yr\n\nOptimize pyro-processing and grinding circuits at a 1.2 MTPA plant; lead clinker quality and fuel-mix programs.\n\nRequirements:\n- 5+ years cement process engineering\n- Demonstrated preheater tower / kiln optimization results\n- Quality control systems and lab interface experience\n- Six Sigma a plus\n\nWork authorization: TN visa — Canadian citizens only. The client cannot support Mexican TN applicants for this site. Relocation assistance provided.",
  },
  {
    id: "j8", client_id: "cl5", title: "Mine Planning Engineer (US)", location: "Elko, NV, US",
    salary_range: "$90k–120k/yr", min_years: 4, status: "open", visa: "TN_CANADIAN_OR_MEXICAN",
    visa_notes: "TN status supported for Canadian or Mexican citizens; degree evaluation required for Mexican credentials.",
    opened_days_ago: 18,
    skills: [["Mine Planning", 3], ["Drill & Blast Design", 2], ["AutoCAD", 2], ["Geology", 2], ["Cost Modeling", 1]],
    requirements: ["4+ yrs open-pit mine planning", "Short- and long-range planning", "Drill & blast design", "Mine planning software (Deswik/Vulcan)"],
    description: "Short- and long-range open-pit planning for a Nevada gold operation.",
    jd_text: "Mine Planning Engineer\nGranite Peak Mining · Elko, Nevada\nCompensation: $90k–120k/yr\n\nBuild short- and long-range open-pit plans for a producing gold operation; own bench sequencing and equipment hours forecasting.\n\nRequirements:\n- 4+ years open-pit mine planning\n- Drill & blast design fundamentals\n- Deswik, Vulcan or Surpac proficiency; strong AutoCAD\n- Geology literacy and cost modeling exposure\n\nWork authorization: TN visa supported for Canadian or Mexican professionals (NAFTA/USMCA engineering category).",
  },
  {
    id: "j9", client_id: "cl6", title: "Melt Shop Supervisor – Steel", location: "Pittsburgh, PA, US",
    salary_range: "$85k–105k/yr", min_years: 7, status: "open", visa: "US_CITIZEN_GC_ONLY",
    visa_notes: "ITAR-adjacent defense orders — US citizens or Green Card holders only; no sponsorship.",
    opened_days_ago: 16,
    skills: [["EAF Operations", 3], ["Continuous Casting", 2], ["Safety Compliance", 2], ["Team Leadership", 2], ["Maintenance Coordination", 1]],
    requirements: ["7+ yrs melt shop operations", "EAF shift leadership", "Continuous caster exposure", "US work authorization (citizen/GC)"],
    description: "Run EAF melt shop shifts: safety, heats-per-shift and crew development.",
    jd_text: "Melt Shop Supervisor – Steel\nIronclad Steelworks · Pittsburgh, Pennsylvania\nCompensation: $85k–105k/yr\n\nRun EAF melt shop shifts — safety, heats-per-shift performance and crew development across a 45-person rotation.\n\nRequirements:\n- 7+ years melt shop operations, 3+ supervising\n- EAF operations depth; continuous casting exposure\n- Strong safety compliance record (OSHA)\n- Maintenance coordination with the reliability team\n\nWork authorization: US citizens or Green Card holders only — must be authorized to work in the US without sponsorship.",
  },
  {
    id: "j10", client_id: "cl6", title: "Senior Metallurgist – Steel", location: "Pittsburgh, PA, US",
    salary_range: "$110k–130k/yr", min_years: 6, status: "open", visa: "H1B_TRANSFER",
    visa_notes: "Client will accept an H-1B transfer for the right candidate; immigration counsel engaged.",
    opened_days_ago: 12,
    skills: [["Metallurgy", 3], ["Failure Analysis", 3], ["Heat Treatment", 2], ["Lab Management", 1]],
    requirements: ["6+ yrs product metallurgy", "Failure analysis leadership", "Heat treatment practice ownership", "Customer-facing technical support"],
    description: "Own product metallurgy and the failure-analysis lab for specialty grades.",
    jd_text: "Senior Metallurgist – Steel\nIronclad Steelworks · Pittsburgh, Pennsylvania\nCompensation: $110k–130k/yr\n\nOwn product metallurgy for specialty bar grades and run the failure-analysis laboratory serving three mills.\n\nRequirements:\n- 6+ years product metallurgy in steel\n- Failure analysis leadership; customer claim resolution\n- Heat treatment practice ownership\n- Lab management experience\n\nWork authorization: H-1B transfer accepted for the right candidate.",
  },
  {
    id: "j11", client_id: "cl6", title: "Shift Production Supervisor – Rolling Mill", location: "Pittsburgh, PA, US",
    salary_range: "$88k–102k/yr", min_years: 6, status: "closed", visa: "SPONSORSHIP_AVAILABLE",
    visa_notes: "Sponsorship available for hard-to-fill mill leadership roles.",
    opened_days_ago: 120,
    skills: [["Rolling Mill Operations", 3], ["Production Planning", 2], ["Team Leadership", 2], ["Safety Compliance", 2]],
    requirements: ["6+ yrs rolling mill operations", "Shift leadership of 30+ crews", "Production planning", "Safety-first mindset"],
    description: "Filled — rolling mill shift leadership role (placement: Victor Salazar).",
    jd_text: "Shift Production Supervisor – Rolling Mill\nIronclad Steelworks · Pittsburgh, Pennsylvania\nCompensation: $88k–102k/yr\n\nLead rolling mill production shifts: cobble reduction, changeover discipline and crew development.\n\nRequirements:\n- 6+ years rolling mill operations\n- Led shifts of 30+ across rolling and finishing\n- Production planning fluency\n- Safety-first leadership\n\nWork authorization: sponsorship available for exceptional international candidates.",
  },
];

const CANDIDATE_SEEDS: readonly CandidateSeed[] = [
  {
    id: "c1", name: "Alex Miller", location: "Cebu, PH", phone: "+63 917 555 0101", source: "LinkedIn",
    years_exp: 14, expected_salary: "₱220,000/mo", notice_period: "60 days",
    skills: [["Plant Operations", 14], ["Kiln Management", 11], ["Safety Compliance", 9], ["Team Leadership", 10], ["Budgeting", 6]],
    certifications: ["ISO 45001 Lead Auditor", "Six Sigma Black Belt"],
    summary: "Seasoned cement plant leader; ran a 3 MTPA integrated line with 220 staff and cut kiln downtime 18%.",
    tags: ["Top Tier", "Leadership"], flagged: true,
  },
  {
    id: "c2", name: "Sarah Jenkins", location: "Davao, PH", phone: "+63 917 555 0102", source: "Referral",
    years_exp: 8, expected_salary: "₱135,000/mo", notice_period: "30 days",
    skills: [["Reliability Engineering", 8], ["Predictive Maintenance", 7], ["SAP PM", 5], ["Root Cause Analysis", 6], ["Vibration Analysis", 4]],
    certifications: ["CMRP", "ISO 18436 Cat II Vibration"],
    summary: "Reliability engineer who built a predictive maintenance program reducing unplanned downtime 31% at a nickel mine.",
    tags: ["Top Tier"], flagged: true,
  },
  {
    id: "c3", name: "Marcus Thompson", location: "Rizal, PH", phone: "+63 917 555 0103", source: "Job Portal",
    years_exp: 7, expected_salary: "₱105,000/mo", notice_period: "30 days",
    skills: [["Quarry Operations", 7], ["Blasting", 5], ["Heavy Equipment", 6], ["Safety Compliance", 4], ["Production Planning", 3]],
    certifications: ["Licensed Blaster (PNP-FED)", "NCII Heavy Equipment"],
    summary: "Quarry supervisor with full drill-blast-crush cycle ownership; improved crusher utilization to 87%.",
    tags: ["Remote Ready"],
  },
  {
    id: "c4", name: "Diana Reyes", location: "Surigao, PH", phone: "+63 917 555 0104", source: "LinkedIn",
    years_exp: 11, expected_salary: "₱165,000/mo", notice_period: "45 days",
    skills: [["Safety Compliance", 11], ["HSE Management", 9], ["Incident Investigation", 8], ["Training", 7], ["Audit", 6]],
    certifications: ["ISO 45001 Lead Auditor", "NEBOSH IGC"],
    summary: "HSE leader across 3 mine sites; led a 4-year LTI-free program and DENR audit readiness.",
    tags: ["Top Tier", "Leadership"],
  },
  {
    id: "c5", name: "James Uy", location: "Cebu, PH", phone: "+63 917 555 0105", source: "Indeed",
    years_exp: 5, expected_salary: "₱95,000/mo", notice_period: "30 days",
    skills: [["Electrical Systems", 5], ["PLC Programming", 3], ["Motor Control", 4], ["Power Distribution", 3]],
    certifications: ["REE License"],
    summary: "Plant electrical engineer; led MV switchgear upgrade and PLC migration to S7-1500.",
  },
  {
    id: "c6", name: "Maria Santos", location: "Cebu, PH", phone: "+63 917 555 0106", source: "Referral",
    years_exp: 9, expected_salary: "₱170,000/mo", notice_period: "60 days",
    skills: [["Plant Operations", 9], ["Safety Compliance", 7], ["Team Leadership", 6], ["Budgeting", 5]],
    certifications: ["Six Sigma Green Belt"],
    summary: "Production manager in cement grinding; strong cost control, limited kiln exposure.",
    tags: ["Leadership"],
  },
  {
    id: "c7", name: "Robert Lim", location: "Davao, PH", phone: "+63 917 555 0107", source: "LinkedIn",
    years_exp: 4, expected_salary: "₱90,000/mo", notice_period: "15 days",
    skills: [["Predictive Maintenance", 4], ["Vibration Analysis", 3], ["Root Cause Analysis", 3]],
    certifications: ["ISO 18436 Cat I"],
    summary: "Condition-monitoring analyst moving into reliability engineering; strong vibration analysis.",
  },
  {
    id: "c8", name: "Angela Cruz", location: "Rizal, PH", phone: "+63 917 555 0108", source: "Job Portal",
    years_exp: 6, expected_salary: "₱55,000/mo", notice_period: "30 days",
    skills: [["Logistics", 6], ["Dispatch", 5], ["ERP Systems", 4], ["Excel", 6], ["Vendor Management", 3]],
    certifications: ["CLTD"],
    summary: "Dispatch lead for a 60-truck aggregates fleet; cut idle time 22% with route scheduling.",
  },
  {
    id: "c9", name: "Kevin Tan", location: "Rizal, PH", phone: "+63 917 555 0109", source: "Indeed",
    years_exp: 3, expected_salary: "₱70,000/mo", notice_period: "15 days",
    skills: [["Heavy Equipment", 3], ["Quarry Operations", 2]],
    certifications: ["NCII Heavy Equipment"],
    summary: "Heavy equipment operator stepping up to supervision; limited blasting exposure.",
  },
  {
    id: "c10", name: "Patricia Gomez", location: "Manila, PH", phone: "+63 917 555 0110", source: "Agency",
    years_exp: 8, expected_salary: "₱150,000/mo", notice_period: "30 days",
    skills: [["HSE Management", 8], ["Safety Compliance", 8], ["Training", 6], ["Audit", 4]],
    certifications: ["NEBOSH IGC", "OSHA 30"],
    summary: "HSE superintendent in construction transitioning to mining; strong training systems.",
  },
  {
    id: "c11", name: "Daniel Ocampo", location: "Manila, PH", phone: "+63 917 555 0111", source: "Job Portal",
    years_exp: 6, expected_salary: "₱140,000/mo", notice_period: "30 days",
    skills: [["Plant Operations", 6], ["Budgeting", 3]],
    certifications: [],
    summary: "Operations supervisor in food manufacturing; no heavy-industry exposure.",
  },
  {
    id: "c12", name: "Grace Villanueva", location: "Cebu, PH", phone: "+63 917 555 0112", source: "Referral",
    years_exp: 6, expected_salary: "₱105,000/mo", notice_period: "30 days",
    skills: [["Electrical Systems", 6], ["PLC Programming", 5], ["Motor Control", 4], ["Power Distribution", 4], ["Safety Compliance", 3]],
    certifications: ["PEE License"],
    summary: "Senior plant electrician turned engineer; SCADA and MV distribution strength.",
    tags: ["Top Tier"],
  },
  {
    id: "c13", name: "Carlo Mendoza", location: "Davao, PH", phone: "+63 917 555 0113", source: "LinkedIn",
    years_exp: 7, expected_salary: "₱120,000/mo", notice_period: "45 days",
    skills: [["Reliability Engineering", 6], ["SAP PM", 6], ["Root Cause Analysis", 5], ["Predictive Maintenance", 3]],
    certifications: ["CMRP (in progress)"],
    summary: "Maintenance planner with strong SAP PM mastery; building PdM exposure.",
  },
  {
    id: "c14", name: "Liza Fernandez", location: "Rizal, PH", phone: "+63 917 555 0114", source: "Job Portal",
    years_exp: 4, expected_salary: "₱48,000/mo", notice_period: "30 days",
    skills: [["Logistics", 4], ["ERP Systems", 3], ["Excel", 5]],
    certifications: [],
    summary: "Logistics analyst with SAP MM background; no dispatch floor experience.",
  },
  {
    id: "c15", name: "Miguel Bautista", location: "Rizal, PH", phone: "+63 917 555 0115", source: "Referral",
    years_exp: 9, expected_salary: "₱118,000/mo", notice_period: "60 days",
    skills: [["Quarry Operations", 9], ["Blasting", 8], ["Heavy Equipment", 7], ["Safety Compliance", 6], ["Production Planning", 5]],
    certifications: ["Licensed Blaster (PNP-FED)", "OSHA 30"],
    summary: "Veteran quarry supervisor; ran 3 quarry pits concurrently with zero LTI over 5 years.",
    tags: ["Top Tier"], flagged: true,
  },
  {
    id: "c16", name: "Hannah Dizon", location: "Manila, PH", phone: "+63 917 555 0116", source: "LinkedIn",
    years_exp: 5, expected_salary: "₱100,000/mo", notice_period: "30 days",
    skills: [["Safety Compliance", 5], ["Training", 4], ["Incident Investigation", 3]],
    certifications: ["OSHA 30"],
    summary: "Safety officer in manufacturing; growing into HSE management.",
  },
  {
    id: "c17", name: "Paolo Ramos", location: "Cebu, PH", phone: "+63 917 555 0117", source: "Indeed",
    years_exp: 4, expected_salary: "₱85,000/mo", notice_period: "30 days",
    skills: [["Electrical Systems", 4], ["Power Distribution", 3], ["PLC Programming", 2]],
    certifications: ["REE License"],
    summary: "Facilities electrical engineer; commercial buildings background.",
  },
  {
    id: "c18", name: "Nicole Aquino", location: "Manila, PH", phone: "+63 917 555 0118", source: "Agency",
    years_exp: 12, expected_salary: "₱210,000/mo", notice_period: "90 days",
    skills: [["Plant Operations", 12], ["Kiln Management", 8], ["Team Leadership", 9], ["Safety Compliance", 7], ["Budgeting", 8]],
    certifications: ["Six Sigma Black Belt"],
    summary: "Deputy plant manager at a competing cement producer; kiln and finance fluent.",
    tags: ["Top Tier"], flagged: true,
  },
  {
    id: "c19", name: "Ethan Caldwell", location: "Calgary, AB, Canada", phone: "+1 403 555 0119", source: "LinkedIn",
    years_exp: 7, expected_salary: "$105,000/yr", notice_period: "30 days",
    skills: [["Pyro Processing", 6], ["Process Optimization", 5], ["Kiln Management", 4], ["Quality Control", 4], ["Six Sigma", 2]],
    certifications: ["P.Eng. (Alberta)", "Six Sigma Green Belt"],
    summary: "Cement process engineer; led a preheater tower optimization adding 8% clinker capacity at a 1.8 MTPA plant. Canadian citizen — TN eligible.",
    tags: ["Top Tier", "TN Eligible"], flagged: true,
  },
  {
    id: "c20", name: "Sophie Tremblay", location: "Montreal, QC, Canada", phone: "+1 514 555 0120", source: "Referral",
    years_exp: 5, expected_salary: "$98,000/yr", notice_period: "60 days",
    skills: [["Mine Planning", 5], ["AutoCAD", 4], ["Geology", 3], ["Drill & Blast Design", 2], ["Cost Modeling", 2]],
    certifications: ["P.Eng. (OIQ)"],
    summary: "Open-pit mine planning engineer at a gold operation; built 5-year life-of-mine plans in Deswik. Canadian citizen — TN eligible.",
    tags: ["TN Eligible"],
  },
  {
    id: "c21", name: "Mateo Hernandez", location: "Monterrey, MX", phone: "+52 81 555 0121", source: "Job Portal",
    years_exp: 4, expected_salary: "$85,000/yr", notice_period: "30 days",
    skills: [["Mine Planning", 3], ["AutoCAD", 3], ["Geology", 2], ["Cost Modeling", 1]],
    certifications: ["Autodesk Certified Professional"],
    summary: "Mine planning engineer at an aggregates producer; strong pit design fundamentals. Mexican citizen — TN eligible.",
    tags: ["TN Eligible"],
  },
  {
    id: "c22", name: "Brian O'Neal", location: "Pittsburgh, PA, US", phone: "+1 412 555 0122", source: "Indeed",
    years_exp: 9, expected_salary: "$98,000/yr", notice_period: "30 days",
    skills: [["EAF Operations", 8], ["Continuous Casting", 6], ["Team Leadership", 6], ["Safety Compliance", 5], ["Maintenance Coordination", 4]],
    certifications: ["OSHA 30", "AIST Safety Committee"],
    summary: "Melt shop shift supervisor across two EAF campaigns; cut average heat time 7% while holding zero LTIs. US citizen.",
    tags: ["Top Tier"], flagged: true,
  },
  {
    id: "c23", name: "Priya Raman", location: "Cleveland, OH, US", phone: "+1 216 555 0123", source: "Agency",
    years_exp: 6, expected_salary: "$115,000/yr", notice_period: "60 days",
    skills: [["Metallurgy", 6], ["Failure Analysis", 5], ["Heat Treatment", 4], ["Lab Management", 3]],
    certifications: ["ASM Certified Metallurgist", "Six Sigma Green Belt"],
    summary: "Product metallurgist in specialty steel; runs a failure-analysis lab serving 3 mills. Currently on H-1B (transfer feasible).",
  },
  {
    id: "c24", name: "Victor Salazar", location: "Pittsburgh, PA, US", phone: "+1 412 555 0124", source: "Agency",
    years_exp: 11, expected_salary: "$92,000/yr", notice_period: "14 days",
    skills: [["Rolling Mill Operations", 10], ["Production Planning", 8], ["Team Leadership", 9], ["Safety Compliance", 7]],
    certifications: ["OSHA 30"],
    summary: "Rolling-mill production lead; placed by JeniMcRich at Ironclad Steelworks and started in March. US Green Card holder.",
  },
];

/** [id, candidate, job, stage, days_in_stage, days_since_applied] */
const APPLICATION_SEEDS: readonly AppSeed[] = [
  ["a1", "c1", "j1", "interview", 3, 21],
  ["a2", "c2", "j3", "offer", 2, 29],
  ["a3", "c3", "j2", "screening", 7, 21],
  ["a4", "c4", "j4", "interview", 6, 23],
  ["a5", "c5", "j5", "applied", 2, 8],
  ["a6", "c6", "j1", "screening", 9, 21],
  ["a7", "c7", "j3", "applied", 1, 6],
  ["a8", "c8", "j6", "interview", 8, 23],
  ["a9", "c9", "j2", "applied", 12, 20],
  ["a10", "c10", "j4", "screening", 4, 13],
  ["a11", "c11", "j1", "rejected", 5, 17],
  ["a12", "c12", "j5", "hired", 1, 25],
  ["a13", "c13", "j3", "interview", 11, 27],
  ["a14", "c14", "j6", "applied", 3, 8],
  ["a15", "c15", "j2", "offer", 1, 23],
  ["a16", "c16", "j4", "applied", 6, 13],
  ["a17", "c17", "j5", "screening", 13, 22],
  ["a18", "c18", "j1", "applied", 8, 14],
  ["a19", "c19", "j7", "interview", 4, 17],
  ["a20", "c20", "j8", "screening", 6, 14],
  ["a21", "c21", "j8", "applied", 2, 7],
  ["a22", "c22", "j9", "offer", 3, 22],
  ["a23", "c23", "j10", "screening", 8, 18],
  ["a24", "c24", "j11", "hired", 75, 113],
  // Multi-application candidates:
  ["a25", "c20", "j7", "applied", 3, 3], // Sophie also in the TN-Canadian-only req (she is Canadian)
  ["a26", "c6", "j7", "rejected", 8, 18], // Maria not TN-eligible (PH citizen) — visa rejection
];

const NOTE_SEEDS: readonly NoteSeed[] = [
  ["n1", "c1", "Jenny M.", "screening", "Phone screen complete — open to relocating within Cebu; comp expectation ₱220k/mo confirmed. Wants clarity on the kiln modernization budget.", 18],
  ["n2", "c2", "Jenny M.", "client_feedback", "Orion's engineering director was impressed by her PdM roadmap — wants the offer out this week.", 5],
  ["n3", "c4", "R. Santos", "interview_feedback", "First round: deep incident-investigation frameworks (ICAM). Panel should probe multi-site rollout experience.", 6],
  ["n4", "c6", "Jenny M.", "general", "Strong grinding-side operations but limited kiln exposure — asked Helix whether grinding background is acceptable.", 9],
  ["n5", "c9", "R. Santos", "general", "Operator stepping up — suggested a supervisory short-course before client submission.", 11],
  ["n6", "c11", "Jenny M.", "client_feedback", "Helix passed — needs heavy-industry exposure. Keep in pipeline for FMCG-adjacent plant roles.", 5],
  ["n7", "c15", "Jenny M.", "compensation", "Expecting ₱118k; Stonebridge budget tops out at ₱120k incl. allowances — aligned, drafting offer.", 3],
  ["n8", "c19", "Jenny M.", "screening", "Confirmed Canadian citizenship; passport valid to 2031 — TN-eligible for Lonestar. Open to Amarillo relocation.", 7],
  ["n9", "c21", "R. Santos", "screening", "Mexican citizen — TN-eligible for the Granite Peak role. Needs credential evaluation for the engineering degree; sent checklist.", 1],
  ["n10", "c23", "Jenny M.", "general", "On H-1B with ~3 years remaining; Ironclad's immigration counsel confirms a transfer is feasible this quarter.", 4],
  ["n11", "c22", "C. dela Peña", "interview_feedback", "Melt shop walkthrough went well — client highlighted his heat-time reduction playbook.", 5],
  ["n12", "c12", "Jenny M.", "general", "Offer accepted verbally; start date pending notice-period negotiation.", 6],
  ["n13", "c6", "R. Santos", "general", "Not TN-eligible for the Lonestar process role (PH citizen) — withdrawn from the US req; still active for Helix Plant Manager.", 8],
];

const INTERVIEW_SEEDS: readonly InterviewSeed[] = [
  { id: "iv1", application_id: "a1", interviewer_id: "u1", day: 1, time: "10:00", type: "final_panel", status: "scheduled", booked_days_ago: 2 },
  { id: "iv2", application_id: "a4", interviewer_id: "u2", day: 0, time: "15:00", type: "technical", status: "scheduled", booked_days_ago: 3 },
  { id: "iv3", application_id: "a8", interviewer_id: "u1", day: 3, time: "09:30", type: "hr_interview", status: "scheduled", booked_days_ago: 1 },
  { id: "iv4", application_id: "a13", interviewer_id: "u2", day: 5, time: "13:00", type: "technical", status: "scheduled", booked_days_ago: 2 },
  { id: "iv5", application_id: "a19", interviewer_id: "u3", day: 1, time: "14:00", type: "client_interview", status: "scheduled", booked_days_ago: 1 },
  { id: "iv6", application_id: "a22", interviewer_id: "u1", day: 2, time: "10:00", type: "final_panel", status: "scheduled", booked_days_ago: 2 },
  // Same instant as iv5 but a DIFFERENT interviewer — proves the guard is per-interviewer.
  // Booking u1 or u3 again at REFERENCE_NOW+1d 14:00 must throw SLOT_TAKEN.
  { id: "iv7", application_id: "a20", interviewer_id: "u1", day: 1, time: "14:00", type: "hr_interview", status: "scheduled", booked_days_ago: 1 },
  { id: "iv8", application_id: "a2", interviewer_id: "u2", day: -6, time: "10:00", type: "technical", status: "completed", booked_days_ago: 9 },
  { id: "iv9", application_id: "a15", interviewer_id: "u1", day: -4, time: "11:00", type: "final_panel", status: "completed", booked_days_ago: 7 },
  { id: "iv10", application_id: "a17", interviewer_id: "u3", day: -1, time: "09:00", type: "hr_interview", status: "cancelled", booked_days_ago: 4 },
  { id: "iv11", application_id: "a24", interviewer_id: "u3", day: -80, time: "13:00", type: "client_interview", status: "completed", booked_days_ago: 83 },
];

const SCORECARD_SEEDS: readonly ScorecardSeed[] = [
  ["sc1", "a2", "u2", { "Technical Skills": 5, "Industry Experience": 4, "Communication": 4, "Leadership": 4, "Culture Fit": 5, "Problem-Solving": 5 }, "Outstanding technical depth; clear PdM program ownership.", "strong_hire", 6],
  ["sc2", "a15", "u1", { "Technical Skills": 5, "Industry Experience": 5, "Communication": 3, "Leadership": 4, "Culture Fit": 4, "Problem-Solving": 4 }, "Deep quarry expertise, slightly reserved communicator.", "hire", 4],
  ["sc3", "a22", "u3", { "Technical Skills": 4, "Industry Experience": 5, "Communication": 4, "Leadership": 4, "Culture Fit": 4, "Problem-Solving": 4 }, "Strong EAF fundamentals; client panel aligned on hire pending final round.", "hire", 5],
  ["sc4", "a19", "u2", { "Technical Skills": 5, "Industry Experience": 4, "Communication": 4, "Leadership": 3, "Culture Fit": 4, "Problem-Solving": 5 }, "Excellent pyro fundamentals with quantified optimization wins. TN paperwork is straightforward.", "strong_hire", 2],
];

const DOCUMENT_SEEDS: readonly DocSeed[] = [
  ["d1", "c1", "Alex_Miller_Resume.pdf", "resume", 21],
  ["d2", "c1", "ISO45001_Lead_Auditor_Cert.pdf", "certification", 19],
  ["d3", "c2", "Sarah_Jenkins_Resume.pdf", "resume", 29],
  ["d4", "c4", "Diana_Reyes_Resume.pdf", "resume", 23],
  ["d5", "c12", "Grace_Villanueva_Resume.pdf", "resume", 25],
  ["d6", "c12", "Offer_Letter_Grace_Villanueva.pdf", "offer_letter", 6],
  ["d7", "c15", "Miguel_Bautista_Resume.pdf", "resume", 23],
  ["d8", "c19", "Ethan_Caldwell_Resume.pdf", "resume", 17],
  ["d9", "c22", "Brian_ONeal_Resume.pdf", "resume", 22],
  ["d10", "c24", "Offer_Letter_Victor_Salazar.pdf", "offer_letter", 78],
];

const TEMPLATE_SEEDS: ReadonlyArray<readonly [string, string, TemplateCategory, string, string]> = [
  ["t1", "Interview Invitation", "interview",
    "Interview Invitation – {{job_title}} at {{client}}",
    "Hi {{candidate_name}},\n\nThank you for your interest in the {{job_title}} role with {{client}}. We would like to invite you to an interview.\n\nProposed date: {{interview_date}}\n\nPlease confirm your availability.\n\nBest regards,\n{{recruiter_name}}\nJeniMcRich Recruitment"],
  ["t2", "Rejection – After Review", "rejection",
    "Update on your application – {{job_title}}",
    "Hi {{candidate_name}},\n\nThank you for applying for the {{job_title}} position. After careful review, we have decided to move forward with other candidates at this time.\n\nWe will keep your profile in our talent pipeline for future roles.\n\nKind regards,\n{{recruiter_name}}\nJeniMcRich Recruitment"],
  ["t3", "Offer Letter Cover", "offer",
    "Offer of Employment – {{job_title}}",
    "Dear {{candidate_name}},\n\nCongratulations! {{client}} is pleased to extend an offer for the position of {{job_title}}.\n\nPlease find the formal offer attached. Kindly confirm receipt and respond within 5 business days.\n\nWarm regards,\n{{recruiter_name}}\nJeniMcRich Recruitment"],
  ["t4", "Status Update – In Progress", "update",
    "Your application status – {{job_title}}",
    "Hi {{candidate_name}},\n\nA quick update: your application for {{job_title}} is currently at the {{stage}} stage. We will reach out with next steps shortly.\n\nThanks for your patience,\n{{recruiter_name}}"],
  ["t5", "Missing Documents Reminder", "update",
    "Action needed – documents for your application",
    "Hi {{candidate_name}},\n\nWe noticed your profile for {{job_title}} is missing required documents. Please upload them at your earliest convenience so we can keep your application moving.\n\nThank you,\n{{recruiter_name}}"],
];

const EMAIL_SEEDS: readonly EmailSeed[] = [
  ["e1", "c1", "t1", "Interview Invitation – Plant Manager – Cement at Helix Cement Corp", 2, "opened"],
  ["e2", "c2", "t4", "Your application status – Maintenance Reliability Engineer", 7, "delivered"],
  ["e3", "c12", "t3", "Offer of Employment – Electrical Engineer – Plant", 6, "opened"],
  ["e4", "c11", "t2", "Update on your application – Plant Manager – Cement", 5, "delivered"],
  ["e5", "c19", "t1", "Interview Invitation – Process Engineer – Cement (US) at Lonestar Cement USA", 1, "opened"],
  ["e6", "c20", "t4", "Your application status – Mine Planning Engineer (US)", 1, "sent"],
  ["e7", "c22", "t3", "Offer of Employment – Melt Shop Supervisor – Steel", 3, "opened"],
  ["e8", "c14", "t5", "Action needed – documents for your application", 3, "bounced"],
  ["e9", "c24", "t3", "Offer of Employment – Shift Production Supervisor – Rolling Mill", 80, "delivered"],
];

/* ------------------------------------------------------------------ */
/* Store assembly                                                      */
/* ------------------------------------------------------------------ */

/** Stage history walked for synthetic activity entries. */
function stagePath(stage: Stage): Stage[] {
  switch (stage) {
    case "applied": return ["applied"];
    case "screening": return ["applied", "screening"];
    case "interview": return ["applied", "screening", "interview"];
    case "offer": return ["applied", "screening", "interview", "offer"];
    case "hired": return ["applied", "screening", "interview", "offer", "hired"];
    case "rejected": return ["applied", "rejected"];
  }
}

export function createDemoStore(): DemoStore {
  const clients: Client[] = CLIENT_SEEDS.map((c) => ({
    ...c,
    created_at: ago(200),
    updated_at: ago(200),
  }));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const jobs: Job[] = JOB_SEEDS.map((j) => {
    const opened = ago(j.opened_days_ago, "08:00");
    return {
      id: j.id,
      client_id: j.client_id,
      client_name: clientById.get(j.client_id)?.name ?? "Unknown client",
      title: j.title,
      location: j.location,
      salary_range: j.salary_range,
      min_years: j.min_years,
      description: j.description,
      requirements: [...j.requirements],
      status: j.status,
      visa: j.visa,
      visa_notes: j.visa_notes,
      jd_text: j.jd_text,
      skills: j.skills.map(([skill, weight]) => ({ skill, weight })),
      opened_at: opened,
      archived_at: null,
      created_at: opened,
      updated_at: opened,
    };
  });
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  const candidates: Candidate[] = CANDIDATE_SEEDS.map((c) => ({
    id: c.id,
    full_name: c.name,
    email: fakeEmail(c.name),
    phone: c.phone,
    location: c.location,
    source: c.source,
    years_exp: c.years_exp,
    summary: c.summary,
    expected_salary: c.expected_salary,
    notice_period: c.notice_period,
    resume_text:
      c.summary +
      " Skills: " + c.skills.map(([s]) => s).join(", ") +
      ". Certifications: " + (c.certifications.length ? c.certifications.join(", ") : "none") + ".",
    flagged: c.flagged ?? false,
    skills: c.skills.map(([skill, years]) => ({ skill, years })),
    certifications: [...c.certifications],
    tags: [...(c.tags ?? [])],
    archived_at: null,
    created_at: REFERENCE_NOW_ISO, // patched below from earliest application
    updated_at: REFERENCE_NOW_ISO,
  }));
  const candById = new Map(candidates.map((c) => [c.id, c]));

  const applications: Application[] = APPLICATION_SEEDS.map(
    ([id, candidate_id, job_id, stage, stageDays, appliedDays]) => {
      const applied_at = ago(appliedDays, "08:30");
      const stage_entered_at = stage === "applied" ? applied_at : ago(stageDays, "10:30");
      return {
        id,
        candidate_id,
        job_id,
        stage,
        stage_entered_at,
        applied_at,
        created_at: applied_at,
        updated_at: stage_entered_at,
      };
    },
  );

  // Patch candidate created/updated from their applications.
  for (const cand of candidates) {
    const apps = applications.filter((a) => a.candidate_id === cand.id);
    if (apps.length > 0) {
      cand.created_at = apps.map((a) => a.applied_at).sort()[0] ?? cand.created_at;
      cand.updated_at = apps.map((a) => a.stage_entered_at).sort().at(-1) ?? cand.updated_at;
    }
  }

  const interviewerById = new Map(INTERVIEWERS.map((u) => [u.id, u]));
  const appById = new Map(applications.map((a) => [a.id, a]));

  const notes: Note[] = NOTE_SEEDS.map(([id, candidate_id, author_name, category, body, days]) => ({
    id,
    candidate_id,
    author_name,
    category,
    body,
    created_at: ago(days, "11:15"),
    updated_at: ago(days, "11:15"),
  }));

  const interviews: Interview[] = INTERVIEW_SEEDS.map((iv) => {
    const app = appById.get(iv.application_id);
    const booked = ago(iv.booked_days_ago, "16:00");
    return {
      id: iv.id,
      application_id: iv.application_id,
      candidate_id: app?.candidate_id ?? "",
      interviewer_id: iv.interviewer_id,
      interviewer_name: interviewerById.get(iv.interviewer_id)?.name ?? "Unknown",
      starts_at: at(iv.day, iv.time),
      duration_minutes: iv.duration_minutes ?? 60,
      interview_type: iv.type,
      status: iv.status,
      created_at: booked,
      updated_at: booked,
    };
  });

  const scorecards: Scorecard[] = SCORECARD_SEEDS.map(
    ([id, application_id, interviewer_id, ratings, summary, recommendation, days]) => {
      const app = appById.get(application_id);
      return {
        id,
        application_id,
        candidate_id: app?.candidate_id ?? "",
        interviewer_id,
        interviewer_name: interviewerById.get(interviewer_id)?.name ?? "Unknown",
        ratings: { ...ratings },
        summary,
        recommendation,
        created_at: ago(days, "17:00"),
        updated_at: ago(days, "17:00"),
      };
    },
  );

  const documents: DocumentRecord[] = DOCUMENT_SEEDS.map(([id, candidate_id, file_name, category, days]) => ({
    id,
    candidate_id,
    file_name,
    category,
    uploaded_by: "Jenny M.",
    created_at: ago(days, "09:45"),
    updated_at: ago(days, "09:45"),
  }));

  const templates: EmailTemplate[] = TEMPLATE_SEEDS.map(([id, name, category, subject, body]) => ({
    id,
    name,
    category,
    subject,
    body,
    created_at: ago(90),
    updated_at: ago(90),
  }));

  const email_log: EmailLogEntry[] = EMAIL_SEEDS.map(([id, candidate_id, template_id, subject, days, status]) => {
    const sent = ago(days, "14:30");
    return {
      id,
      candidate_id,
      template_id,
      to_email: candById.get(candidate_id)?.email ?? "unknown@example.com",
      subject,
      status,
      sent_at: sent,
      created_at: sent,
      updated_at: sent,
    };
  });

  /* ---- Synthetic, consistent activity log (append-only audit trail) ---- */

  const raw: Array<Omit<ActivityLogEntry, "id">> = [];
  const log = (candidate_id: string, type: ActivityType, body: string, actor_name: string, atIso: string): void => {
    raw.push({ candidate_id, type, body, actor_name, created_at: atIso, updated_at: atIso });
  };

  for (const app of applications) {
    const job = jobById.get(app.job_id);
    const title = job?.title ?? "Unknown role";
    const cand = candById.get(app.candidate_id);
    log(app.candidate_id, "stage", `Application received via ${cand?.source ?? "Unknown"} — ${title}`, "System", app.applied_at);

    const path = stagePath(app.stage);
    if (path.length > 1) {
      const start = Date.parse(app.applied_at);
      const end = Date.parse(app.stage_entered_at);
      for (let i = 1; i < path.length; i++) {
        const stage = path[i] as Stage;
        const ts = new Date(start + ((end - start) * i) / (path.length - 1)).toISOString();
        log(app.candidate_id, "stage", `Moved to ${STAGE_LABELS[stage]} · ${title}`, "Jenny M.", ts);
      }
    }
  }

  for (const cand of candidates) {
    if (cand.flagged) {
      log(cand.id, "flag", "Flagged as priority candidate", "Jenny M.", plusHours(cand.created_at, 26));
    }
  }
  for (const n of notes) {
    log(n.candidate_id, "note", `Note added (${NOTE_CATEGORY_LABELS[n.category]})`, n.author_name, n.created_at);
  }
  for (const e of email_log) {
    log(e.candidate_id, "email", `Email sent: ${e.subject}`, "Jenny M.", e.sent_at);
  }
  for (const iv of interviews) {
    const label = INTERVIEW_TYPE_LABELS[iv.interview_type];
    log(iv.candidate_id, "interview", `${label} booked: ${formatDateTime(iv.starts_at)} (UTC) with ${iv.interviewer_name} — confirmations sent`, "Jenny M.", iv.created_at);
    if (iv.status === "completed") {
      log(iv.candidate_id, "interview", `${label} completed with ${iv.interviewer_name}`, iv.interviewer_name, plusHours(iv.starts_at, 1));
    } else if (iv.status === "cancelled") {
      log(iv.candidate_id, "interview", `${label} cancelled`, "Jenny M.", plusHours(iv.starts_at, -20));
    }
  }
  for (const sc of scorecards) {
    log(sc.candidate_id, "scorecard", `Scorecard submitted — ${RECOMMENDATION_LABELS[sc.recommendation]}`, sc.interviewer_name, sc.created_at);
  }
  for (const d of documents) {
    log(d.candidate_id, "doc", `Document uploaded: ${d.file_name}`, d.uploaded_by, d.created_at);
  }

  const activity_log: ActivityLogEntry[] = raw
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .map((entry, i) => ({ id: `act${i + 1}`, ...entry }));

  return {
    clients,
    interviewers: [...INTERVIEWERS],
    jobs,
    candidates,
    applications,
    notes,
    scorecards,
    interviews,
    documents,
    templates,
    email_log,
    activity_log,
    settings: { stalled_days: 5, stalled_enabled: true },
    seq: 0,
  };
}
