/**
 * Email merge-field engine — port of `merge()` from
 * `prototype/JeniMcRich-Recruitment-App.html`, plus the template validation
 * required by docs/ARCHITECTURE.md ("throws on unknown fields in templates
 * at save time").
 *
 * Pure: no I/O, no framework imports.
 */

/** The only merge fields templates may use. */
export const MERGE_FIELDS = [
  "candidate_name",
  "job_title",
  "client",
  "recruiter_name",
  "stage",
  "interview_date",
] as const;

export type MergeField = (typeof MERGE_FIELDS)[number];

/**
 * Values for one recipient. `candidate_name` and `stage` always exist on a
 * candidate; the rest are optional and fall back to the prototype's neutral
 * wording (empty strings also fall back, matching the prototype's `||`).
 */
export interface MergeValues {
  candidate_name: string;
  stage: string;
  /** Falls back to "the role". */
  job_title?: string | null;
  /** Falls back to "our client". */
  client?: string | null;
  /** Falls back to "Recruiter". */
  recruiter_name?: string | null;
  /** Falls back to "(to be scheduled)" — e.g. no interview booked yet. */
  interview_date?: string | null;
}

/** Neutral fallbacks used when an optional merge value is missing/empty. */
export const MERGE_FALLBACKS = {
  job_title: "the role",
  client: "our client",
  recruiter_name: "Recruiter",
  interview_date: "(to be scheduled)",
} as const;

/**
 * Thrown when a template references a field that is not in `MERGE_FIELDS`.
 * The message is written for a non-technical user and lists every valid field.
 */
export class UnknownMergeFieldError extends Error {
  readonly unknownFields: readonly string[];

  constructor(unknownFields: readonly string[]) {
    const bad = unknownFields.map((f) => `{{${f}}}`).join(", ");
    const valid = MERGE_FIELDS.map((f) => `{{${f}}}`).join(", ");
    super(
      `Unknown merge field${unknownFields.length > 1 ? "s" : ""}: ${bad}. ` +
        `Valid fields are: ${valid}.`,
    );
    this.name = "UnknownMergeFieldError";
    this.unknownFields = unknownFields;
  }
}

interface Token {
  /** The raw token as it appears in the template, e.g. "{{ stage }}". */
  raw: string;
  /** The trimmed field name inside the braces, e.g. "stage". */
  field: string;
}

function scanTokens(template: string): Token[] {
  const tokens: Token[] = [];
  for (const m of template.matchAll(/\{\{([^{}]*)\}\}/g)) {
    tokens.push({ raw: m[0], field: (m[1] ?? "").trim() });
  }
  return tokens;
}

function isMergeField(field: string): field is MergeField {
  return (MERGE_FIELDS as readonly string[]).includes(field);
}

/**
 * Validate a template (subject or body). Returns the known merge fields it
 * uses (unique, in order of first appearance). Throws `UnknownMergeFieldError`
 * listing every unknown `{{field}}` found. Call this at template save time.
 */
export function validateTemplate(template: string): MergeField[] {
  const used: MergeField[] = [];
  const unknown: string[] = [];
  for (const { field } of scanTokens(template)) {
    if (isMergeField(field)) {
      if (!used.includes(field)) used.push(field);
    } else if (!unknown.includes(field)) {
      unknown.push(field);
    }
  }
  if (unknown.length > 0) throw new UnknownMergeFieldError(unknown);
  return used;
}

function resolveField(field: MergeField, values: MergeValues): string {
  switch (field) {
    case "candidate_name":
      return values.candidate_name;
    case "stage":
      return values.stage;
    case "job_title":
      return values.job_title || MERGE_FALLBACKS.job_title;
    case "client":
      return values.client || MERGE_FALLBACKS.client;
    case "recruiter_name":
      return values.recruiter_name || MERGE_FALLBACKS.recruiter_name;
    case "interview_date":
      return values.interview_date || MERGE_FALLBACKS.interview_date;
  }
}

/**
 * Substitute every `{{merge_field}}` in `template` with the recipient's
 * values (whitespace inside braces is tolerated: `{{ stage }}` works).
 * Throws `UnknownMergeFieldError` if the template references unknown fields,
 * so a bad template can never reach a candidate's inbox half-merged.
 */
export function mergeTemplate(template: string, values: MergeValues): string {
  validateTemplate(template);
  return template.replace(/\{\{([^{}]*)\}\}/g, (raw, inner: string) => {
    const field = inner.trim();
    return isMergeField(field) ? resolveField(field, values) : raw;
  });
}
