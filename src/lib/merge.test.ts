import { describe, expect, it } from "vitest";
import {
  MERGE_FALLBACKS,
  MERGE_FIELDS,
  UnknownMergeFieldError,
  mergeTemplate,
  validateTemplate,
  type MergeValues,
} from "./merge";

const alex: MergeValues = {
  candidate_name: "Alex Miller",
  stage: "Interview",
  job_title: "Plant Manager – Cement",
  client: "Helix Cement Corp",
  recruiter_name: "Jenny M.",
  interview_date: "Jun 12, 2026",
};

/** The prototype's seed template t1 (Interview Invitation). */
const INVITE_SUBJECT = "Interview Invitation – {{job_title}} at {{client}}";
const INVITE_BODY =
  "Hi {{candidate_name}},\n\nThank you for your interest in the {{job_title}} role with {{client}}. " +
  "We would like to invite you to an interview.\n\nProposed date: {{interview_date}}\n\n" +
  "Please confirm your availability.\n\nBest regards,\n{{recruiter_name}}\nJeniMcRich Recruitment";

describe("mergeTemplate", () => {
  it("substitutes all six merge fields", () => {
    const out = mergeTemplate(
      "{{candidate_name}}|{{job_title}}|{{client}}|{{recruiter_name}}|{{stage}}|{{interview_date}}",
      alex,
    );
    expect(out).toBe(
      "Alex Miller|Plant Manager – Cement|Helix Cement Corp|Jenny M.|Interview|Jun 12, 2026",
    );
  });

  it("renders the prototype's Interview Invitation template verbatim", () => {
    expect(mergeTemplate(INVITE_SUBJECT, alex)).toBe(
      "Interview Invitation – Plant Manager – Cement at Helix Cement Corp",
    );
    const body = mergeTemplate(INVITE_BODY, alex);
    expect(body).toContain("Hi Alex Miller,");
    expect(body).toContain("the Plant Manager – Cement role with Helix Cement Corp");
    expect(body).toContain("Proposed date: Jun 12, 2026");
    expect(body).toContain("Best regards,\nJenny M.\nJeniMcRich Recruitment");
    expect(body).not.toContain("{{");
  });

  it("replaces repeated tokens globally (prototype used /g)", () => {
    expect(mergeTemplate("{{candidate_name}} & {{candidate_name}}", alex)).toBe(
      "Alex Miller & Alex Miller",
    );
  });

  it.each([
    ["job_title", "the role"],
    ["client", "our client"],
    ["recruiter_name", "Recruiter"],
    ["interview_date", "(to be scheduled)"],
  ] as const)("falls back for missing %s → %j", (field, fallback) => {
    const values: MergeValues = { candidate_name: "Maria Santos", stage: "Applied" };
    expect(mergeTemplate(`{{${field}}}`, values)).toBe(fallback);
    expect(MERGE_FALLBACKS[field]).toBe(fallback);
  });

  it("treats empty-string values as missing (prototype's `||` semantics)", () => {
    const values: MergeValues = {
      candidate_name: "Maria Santos",
      stage: "Applied",
      job_title: "",
      interview_date: "",
    };
    expect(mergeTemplate("{{job_title}} / {{interview_date}}", values)).toBe(
      "the role / (to be scheduled)",
    );
  });

  it("tolerates whitespace inside the braces", () => {
    expect(mergeTemplate("Now at {{ stage }}.", alex)).toBe("Now at Interview.");
  });

  it("throws on an unknown field instead of sending a half-merged email", () => {
    expect(() => mergeTemplate("Hi {{first_name}}", alex)).toThrow(
      UnknownMergeFieldError,
    );
  });
});

describe("validateTemplate", () => {
  it("returns the known fields used, unique, in order of first appearance", () => {
    expect(validateTemplate(INVITE_BODY)).toEqual([
      "candidate_name",
      "job_title",
      "client",
      "interview_date",
      "recruiter_name",
    ]);
  });

  it("returns [] for a template without merge fields", () => {
    expect(validateTemplate("Plain text, no tokens.")).toEqual([]);
  });

  it("accepts every prototype seed template", () => {
    const seeds = [
      INVITE_SUBJECT,
      INVITE_BODY,
      "Update on your application – {{job_title}}",
      "Hi {{candidate_name}},\n\nA quick update: your application for {{job_title}} is currently at the {{stage}} stage.\n\nThanks,\n{{recruiter_name}}",
      "Offer of Employment – {{job_title}}",
    ];
    for (const tpl of seeds) {
      expect(() => validateTemplate(tpl)).not.toThrow();
    }
  });

  it("throws a human-readable error naming the bad field and listing all valid ones", () => {
    let caught: unknown;
    try {
      validateTemplate("Dear {{firstname}}, see you {{tomorow}} and {{tomorow}}");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UnknownMergeFieldError);
    const error = caught as UnknownMergeFieldError;
    // duplicates are reported once; plural wording for 2+ unknowns
    expect(error.unknownFields).toEqual(["firstname", "tomorow"]);
    expect(error.message).toBe(
      "Unknown merge fields: {{firstname}}, {{tomorow}}. " +
        "Valid fields are: {{candidate_name}}, {{job_title}}, {{client}}, " +
        "{{recruiter_name}}, {{stage}}, {{interview_date}}.",
    );
  });

  it("uses singular wording for a single unknown field", () => {
    expect(() => validateTemplate("{{candidate}}")).toThrow(
      /^Unknown merge field: \{\{candidate\}\}\. Valid fields are:/,
    );
  });

  it("rejects an empty {{}} token", () => {
    expect(() => validateTemplate("Hello {{}}")).toThrow(UnknownMergeFieldError);
  });

  it("ignores single braces and unclosed tokens", () => {
    expect(() => validateTemplate("a {not_a_token} b {{unclosed")).not.toThrow();
    expect(validateTemplate("a {not_a_token} b {{unclosed")).toEqual([]);
  });
});

describe("MERGE_FIELDS", () => {
  it("exposes exactly the six documented fields, in prototype order", () => {
    expect(MERGE_FIELDS).toEqual([
      "candidate_name",
      "job_title",
      "client",
      "recruiter_name",
      "stage",
      "interview_date",
    ]);
  });
});
