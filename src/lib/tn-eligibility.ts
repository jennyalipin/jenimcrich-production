/**
 * TN / USMCA professional-eligibility screen — pure, no I/O.
 *
 * Maps a job title to the closest USMCA professional occupation and reports
 * whether the role plausibly qualifies for TN classification. The occupation
 * categories below are drawn from USMCA Annex 1603, Appendix 1603.D.1 (the
 * NAFTA professionals list carried into USMCA), narrowed to the heavy-industry
 * professions this agency actually places (engineering disciplines, geology /
 * geophysics, scientists, management consultants).
 *
 * ⚠️ NOT LEGAL ADVICE. This occupation list and its title→profession mapping
 * require review and sign-off by a licensed US immigration attorney before
 * influencing any client/candidate decision. Eligibility under TN turns on the
 * specific job duties, the candidate's degree, and CBP officer discretion —
 * none of which a title-string match can establish. The module is a triage aid
 * only: while sign-off is pending (`LEGAL_REVIEW_PENDING`), EVERY result is
 * flagged `legalReviewRequired: true` so nothing is presented as cleared.
 */

/**
 * Master interlock. While true, every eligibility result forces
 * `legalReviewRequired: true` regardless of match confidence — the attorney
 * review of the occupation mapping has not been signed off. Flip to `false`
 * only once a licensed US immigration attorney has reviewed and approved
 * USMCA_OCCUPATIONS and the matching logic below.
 */
export const LEGAL_REVIEW_PENDING = true;

export type EligibilityConfidence = "exact" | "keyword" | "none";

export interface TnEligibilityResult {
  /** True when the title plausibly maps to a USMCA professional occupation. */
  eligible: boolean;
  /** The matched USMCA occupation name, or null when nothing matched. */
  matchedOccupation: string | null;
  /** How the match was made: exact occupation name, keyword, or no match. */
  confidence: EligibilityConfidence;
  /**
   * True when an immigration attorney must review before the result is relied
   * upon. Always true while LEGAL_REVIEW_PENDING; also true for any non-exact
   * match and for explicitly non-professional (operator/technician) titles.
   */
  legalReviewRequired: boolean;
}

/**
 * One USMCA professional occupation relevant to heavy-industry placements.
 * `keywords` are lowercase substrings that, when present in a job title,
 * suggest this occupation. `exact` are full occupation names that count as an
 * exact (highest-confidence) match.
 */
interface UsmcaOccupation {
  name: string;
  exact: readonly string[];
  keywords: readonly string[];
}

/**
 * Heavy-industry-relevant subset of the USMCA professional occupation list.
 * Engineering is enumerated by sub-discipline because TN classification is
 * granted against the specific engineering profession, not "engineer" at large.
 */
export const USMCA_OCCUPATIONS: readonly UsmcaOccupation[] = [
  {
    name: "Engineer (Mining)",
    exact: ["mining engineer"],
    keywords: ["mining engineer", "mine engineer"],
  },
  {
    name: "Engineer (Metallurgical)",
    exact: ["metallurgical engineer"],
    keywords: ["metallurgical engineer", "metallurgist engineer"],
  },
  {
    name: "Engineer (Chemical)",
    exact: ["chemical engineer"],
    keywords: ["chemical engineer", "process engineer"],
  },
  {
    name: "Engineer (Civil)",
    exact: ["civil engineer"],
    keywords: ["civil engineer", "structural engineer", "geotechnical engineer"],
  },
  {
    name: "Engineer (Industrial)",
    exact: ["industrial engineer"],
    keywords: ["industrial engineer", "manufacturing engineer"],
  },
  {
    name: "Engineer (Mechanical)",
    exact: ["mechanical engineer"],
    keywords: ["mechanical engineer", "maintenance engineer", "reliability engineer"],
  },
  {
    name: "Engineer (Electrical)",
    exact: ["electrical engineer"],
    keywords: ["electrical engineer"],
  },
  {
    name: "Engineer (General)",
    exact: ["engineer"],
    // Fallback: a professional "engineer" not caught by a discipline above.
    keywords: ["engineer"],
  },
  {
    name: "Geologist",
    exact: ["geologist"],
    keywords: ["geologist", "geology"],
  },
  {
    name: "Geophysicist",
    exact: ["geophysicist", "geochemist"],
    keywords: ["geophysicist", "geophysics", "geochemist"],
  },
  {
    name: "Scientist (Chemistry)",
    exact: ["chemist"],
    keywords: ["chemist", "chemistry"],
  },
  {
    name: "Scientist (Biology)",
    exact: ["biologist"],
    keywords: ["biologist", "biology"],
  },
  {
    name: "Management Consultant",
    exact: ["management consultant"],
    keywords: ["management consultant"],
  },
];

/**
 * Titles that are explicitly NOT USMCA professionals: trades and operations
 * roles. TN is reserved for professionals holding a relevant degree, so these
 * are ineligible — and flagged for legal review because a recruiter may have
 * mis-titled a genuinely professional role.
 */
const NON_PROFESSIONAL_KEYWORDS: readonly string[] = [
  "operator",
  "technician",
  "welder",
  "labourer",
  "laborer",
  "fitter",
  "mechanic",
  "driver",
  "helper",
  "foreman",
];

/** Lowercased, whitespace-collapsed title for substring matching. */
function normalize(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Whole-word presence of `word` in `title`. Used for the non-professional
 * trade keywords so "mechanic" matches "Heavy Equipment Mechanic" but NOT
 * "Mechanical Engineer" (where "mechanic" is only a substring of "mechanical").
 */
function hasWord(title: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`).test(title);
}

/**
 * Screen a job title for TN/USMCA professional eligibility.
 *
 * Pure and total: never throws; empty/blank titles return a `none` result.
 * Precedence:
 *   1. Non-professional trade titles → eligible:false, review required.
 *   2. Exact occupation-name match → eligible:true, confidence:'exact'.
 *   3. Keyword match → eligible:true, confidence:'keyword', review required.
 *   4. No match → eligible:false, confidence:'none'.
 * While LEGAL_REVIEW_PENDING, every result has legalReviewRequired:true.
 */
export function isTnEligible(jobTitle: string): TnEligibilityResult {
  const title = normalize(jobTitle);

  const withInterlock = (result: TnEligibilityResult): TnEligibilityResult => ({
    ...result,
    legalReviewRequired: result.legalReviewRequired || LEGAL_REVIEW_PENDING,
  });

  if (!title) {
    return withInterlock({
      eligible: false,
      matchedOccupation: null,
      confidence: "none",
      legalReviewRequired: false,
    });
  }

  // (1) Non-professional trades are ineligible, but flag for review in case the
  // title is misleading (e.g. "Reliability Engineer" mislabeled "Mechanic").
  if (NON_PROFESSIONAL_KEYWORDS.some((kw) => hasWord(title, kw))) {
    return withInterlock({
      eligible: false,
      matchedOccupation: null,
      confidence: "none",
      legalReviewRequired: true,
    });
  }

  // (2) Exact occupation-name match — highest confidence.
  for (const occ of USMCA_OCCUPATIONS) {
    if (occ.exact.some((name) => title === name)) {
      return withInterlock({
        eligible: true,
        matchedOccupation: occ.name,
        confidence: "exact",
        // Exact matches don't self-require review; the interlock still gates it.
        legalReviewRequired: false,
      });
    }
  }

  // (3) Keyword match — plausible, but always needs a human/attorney look.
  for (const occ of USMCA_OCCUPATIONS) {
    if (occ.keywords.some((kw) => title.includes(kw))) {
      return withInterlock({
        eligible: true,
        matchedOccupation: occ.name,
        confidence: "keyword",
        legalReviewRequired: true,
      });
    }
  }

  // (4) No professional occupation matched.
  return withInterlock({
    eligible: false,
    matchedOccupation: null,
    confidence: "none",
    legalReviewRequired: false,
  });
}

/** One required-document line in the TN paperwork checklist. */
export interface TnRequiredDocSpec {
  /** The `document_category` enum value this maps to (migration 0013). */
  category: string;
  label: string;
  hint: string;
}

/**
 * The TN paperwork a candidate needs before a port-of-entry presentation:
 * the employer support letter, a credential evaluation (for non-US degrees),
 * a passport copy, and — once admitted — the I-94 admission record.
 */
export const TN_REQUIRED_DOCS: readonly TnRequiredDocSpec[] = [
  {
    category: "tn_support_letter",
    label: "TN support letter",
    hint: "Employer letter stating the USMCA profession, duties, term and credentials.",
  },
  {
    category: "credential_evaluation",
    label: "Credential evaluation",
    hint: "Degree / licence evaluation establishing the candidate meets the profession's requirements.",
  },
  {
    category: "passport_copy",
    label: "Passport copy",
    hint: "Canadian or Mexican passport bio page.",
  },
  {
    category: "i94_record",
    label: "I-94 record",
    hint: "Admission record issued at the port of entry once TN status is granted.",
  },
] as const;
