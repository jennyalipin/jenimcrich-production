import { describe, expect, it } from "vitest";
import { DEFAULT_SKILL_DICTIONARY, detectVisa, parseJD } from "./jd-parser";

/**
 * Realistic heavy-industry JD modeled on the prototype's seed job j1
 * (Plant Manager – Cement, Helix Cement Corp).
 */
const PLANT_MANAGER_JD = `Job Title: Plant Manager – Cement
Company: Helix Cement Corp.
Location: Cebu, PH
Salary range: ₱180k–240k/mo

Helix Cement Corp is seeking an experienced plant leader to run a 2.5 MTPA integrated cement line, owning production, maintenance and the full plant P&L.

Requirements:
- 10+ years of cement plant operations
- Kiln Management and pyro-processing expertise
- Safety Compliance leadership (ISO 45001)
- Team Leadership of 100+ headcount
- Licensed Mechanical Engineer preferred

Work authorization: US citizens or Green Card holders only.
Kiln Management experience is non-negotiable.`;

describe("parseJD — full JD extraction", () => {
  const parsed = parseJD(PLANT_MANAGER_JD);

  it("extracts labeled title, client, location and salary", () => {
    expect(parsed.title).toBe("Plant Manager – Cement");
    // trailing punctuation is stripped: "Helix Cement Corp." → "Helix Cement Corp"
    expect(parsed.client).toBe("Helix Cement Corp");
    expect(parsed.location).toBe("Cebu, PH");
    expect(parsed.salary).toBe("₱180k–240k/mo");
  });

  it("extracts the minimum years of experience", () => {
    expect(parsed.minYears).toBe(10);
  });

  it("extracts requirement bullets with markers stripped", () => {
    expect(parsed.requirements).toEqual([
      "10+ years of cement plant operations",
      "Kiln Management and pyro-processing expertise",
      "Safety Compliance leadership (ISO 45001)",
      "Team Leadership of 100+ headcount",
      "Licensed Mechanical Engineer preferred",
    ]);
  });

  it("weights dictionary skills by frequency (≥2 mentions → 3, once → 2)", () => {
    // "Kiln Management" appears twice in the JD; the others once.
    expect(parsed.skills).toContainEqual({ skill: "Kiln Management", weight: 3 });
    expect(parsed.skills).toContainEqual({ skill: "Plant Operations", weight: 2 });
    expect(parsed.skills).toContainEqual({ skill: "Safety Compliance", weight: 2 });
    expect(parsed.skills).toContainEqual({ skill: "Team Leadership", weight: 2 });
  });

  it("adds capitalized multi-word phrases from bullets as weight-1 skills", () => {
    expect(parsed.skills).toContainEqual({
      skill: "Licensed Mechanical Engineer",
      weight: 1,
    });
    // already-found dictionary skills are not duplicated by the phrase pass
    const kiln = parsed.skills.filter(
      (s) => s.skill.toLowerCase() === "kiln management",
    );
    expect(kiln).toHaveLength(1);
  });

  it("detects the visa requirement and captures the visa line as notes", () => {
    expect(parsed.visa).toBe("US_CITIZEN_GC_ONLY");
    expect(parsed.visaNotes).toBe(
      "Work authorization: US citizens or Green Card holders only.",
    );
  });

  it("uses the first >60-char non-bullet paragraph as description (faithful to prototype — the header block qualifies)", () => {
    expect(parsed.description.startsWith("Job Title: Plant Manager – Cement")).toBe(
      true,
    );
    expect(parsed.description.length).toBeLessThanOrEqual(300);
  });
});

describe("parseJD — fallbacks and heuristics", () => {
  it("falls back to the first short line for the title when no label exists", () => {
    const parsed = parseJD(
      "Maintenance Reliability Engineer\nOrion Mining Group — Davao\n\n5+ yrs reliability in mining required. CMRP preferred.",
    );
    expect(parsed.title).toBe("Maintenance Reliability Engineer");
    expect(parsed.minYears).toBe(5);
  });

  it("grabs an unlabeled salary via the currency pattern", () => {
    const parsed = parseJD("Offering ₱90k–120k/mo for the right candidate.");
    expect(parsed.salary).toBe("₱90k–120k/mo");
  });

  it("returns null minYears when the JD states none", () => {
    expect(parseJD("Quarry Supervisor\nGreat role.").minYears).toBeNull();
  });

  it("picks a real description paragraph and trims it to 300 chars", () => {
    const longPara =
      "Stonebridge Aggregates is hiring a quarry supervisor to run drilling, blasting and crushing operations across two sites. " +
      "x".repeat(400);
    const parsed = parseJD(`Quarry Supervisor\n\n${longPara}`);
    expect(parsed.description).toBe(longPara.slice(0, 300));
    expect(parsed.description).toHaveLength(300);
  });

  it("caps requirements at 8 and supports -, •, *, ▪, ◦ markers", () => {
    const bullets = [
      "- one",
      "• two",
      "* three",
      "▪ four",
      "◦ five",
      "- six",
      "- seven",
      "- eight",
      "- nine",
      "- ten",
    ].join("\n");
    const parsed = parseJD(`Role: Test\n${bullets}`);
    expect(parsed.requirements).toHaveLength(8);
    expect(parsed.requirements[0]).toBe("one");
    expect(parsed.requirements[4]).toBe("five");
    expect(parsed.requirements).not.toContain("nine");
  });

  it("caps detected skills at 8, keeping dictionary order", () => {
    const nine =
      "Plant Operations, Kiln Management, Safety Compliance, Team Leadership, " +
      "Budgeting, Quarry Operations, Blasting, Heavy Equipment, Production Planning";
    const parsed = parseJD(`Role: Superintendent\nNeeds: ${nine}`);
    expect(parsed.skills).toHaveLength(8);
    expect(parsed.skills.map((s) => s.skill)).not.toContain("Production Planning");
    expect(parsed.skills[0]).toEqual({ skill: "Plant Operations", weight: 2 });
  });

  it("matches dictionary skills case-insensitively, returning canonical casing", () => {
    const parsed = parseJD("Role: Tech\nexperience with sap pm and plc programming");
    expect(parsed.skills).toContainEqual({ skill: "SAP PM", weight: 2 });
    expect(parsed.skills).toContainEqual({ skill: "PLC Programming", weight: 2 });
  });

  it("accepts a custom skill dictionary", () => {
    const parsed = parseJD("Role: Dev\nMust know Rust. Rust daily.", ["Rust"]);
    expect(parsed.skills).toEqual([{ skill: "Rust", weight: 3 }]);
  });

  it("never throws on empty or unstructured text", () => {
    const parsed = parseJD("");
    expect(parsed).toEqual({
      title: "",
      client: "",
      location: "",
      salary: "",
      minYears: null,
      requirements: [],
      skills: [],
      visa: "UNSPECIFIED",
      visaNotes: "",
      description: "",
      // No TN screen on a non-TN (here UNSPECIFIED) visa.
      tnEligibility: null,
    });
  });

  it("runs a TN eligibility screen only when the detected visa is a TN type", () => {
    const tn = parseJD(
      "Job Title: Mining Engineer\nTN visa for Canadians only.\nLead pit design.",
    );
    expect(tn.visa).toBe("TN_CANADIAN_ONLY");
    expect(tn.tnEligibility).not.toBeNull();
    expect(tn.tnEligibility?.eligible).toBe(true);
    expect(tn.tnEligibility?.matchedOccupation).toBe("Engineer (Mining)");
    // Interlock: never auto-cleared while attorney sign-off is pending.
    expect(tn.tnEligibility?.legalReviewRequired).toBe(true);

    const nonTn = parseJD(
      "Job Title: Mining Engineer\nUS citizens or Green Card holders only.",
    );
    expect(nonTn.visa).toBe("US_CITIZEN_GC_ONLY");
    expect(nonTn.tnEligibility).toBeNull();
  });
});

describe("detectVisa — branch coverage (prototype precedence: TN → US/GC → H-1B → sponsorship)", () => {
  it.each([
    ["TN visa — Canadians only", "TN_CANADIAN_ONLY"],
    ["TN status available for Canadian applicants", "TN_CANADIAN_ONLY"],
    ["TN visa for Canadian or Mexican citizens", "TN_CANADIAN_OR_MEXICAN"],
    ["TN visa eligible", "TN_CANADIAN_OR_MEXICAN"],
    ["Green Card holders welcome", "US_CITIZEN_GC_ONLY"],
    ["US citizens only", "US_CITIZEN_GC_ONLY"],
    ["Must be authorized to work in the U.S.", "US_CITIZEN_GC_ONLY"],
    ["H-1B transfer accepted", "H1B_TRANSFER"],
    ["We accept H1B candidates", "H1B_TRANSFER"],
    ["Sponsorship is available for this role", "SPONSORSHIP_AVAILABLE"],
    ["Open to international applicants", "SPONSORSHIP_AVAILABLE"],
    ["No work-authorization wording at all", "UNSPECIFIED"],
    ["", "UNSPECIFIED"],
  ] as const)("detectVisa(%j) → %s", (text, expected) => {
    expect(detectVisa(text)).toBe(expected);
  });

  it("gives TN precedence over an H-1B mention in the same JD", () => {
    expect(detectVisa("H-1B transfer accepted; TN visa for Canadians")).toBe(
      "TN_CANADIAN_ONLY",
    );
  });

  it("gives US/GC precedence over a sponsorship mention", () => {
    expect(detectVisa("Green card required; sponsorship available later")).toBe(
      "US_CITIZEN_GC_ONLY",
    );
  });

  // Regression: restrictive TN roles must NOT demote into the permissive H-1B
  // bucket (compliance — the worst-case wrong direction).
  it.each([
    ["TN-1 visa for Canadian citizens only; no H-1B sponsorship", "TN_CANADIAN_ONLY"],
    ["TN-1 status required. Canadians only.", "TN_CANADIAN_ONLY"],
    ["TN1 visa, Canadians only", "TN_CANADIAN_ONLY"],
    ["TN classification, Canadian or Mexican", "TN_CANADIAN_OR_MEXICAN"],
  ] as const)("classifies restrictive TN phrasing %j → %s", (text, expected) => {
    expect(detectVisa(text)).toBe(expected);
  });

  // Negated H-1B / sponsorship must not read as an offer.
  it("treats 'no H-1B' as a refusal, not H1B_TRANSFER", () => {
    expect(
      detectVisa("Sponsorship is available for the right candidate. No H-1B though."),
    ).toBe("SPONSORSHIP_AVAILABLE");
    expect(detectVisa("Must be authorized to work in the US. No H1B sponsorship.")).toBe(
      "US_CITIZEN_GC_ONLY",
    );
  });

  // The Tennessee state abbreviation must not trigger TN-visa detection.
  it("does not mistake the 'TN' state abbreviation for a TN visa", () => {
    expect(detectVisa("On-site role in Memphis, TN. Local candidates preferred.")).toBe(
      "UNSPECIFIED",
    );
  });
});

describe("DEFAULT_SKILL_DICTIONARY", () => {
  it("contains the prototype's 27 unique seed skills", () => {
    expect(DEFAULT_SKILL_DICTIONARY).toHaveLength(27);
    expect(new Set(DEFAULT_SKILL_DICTIONARY).size).toBe(27);
    expect(DEFAULT_SKILL_DICTIONARY).toContain("Kiln Management");
    expect(DEFAULT_SKILL_DICTIONARY).toContain("Vibration Analysis");
  });
});
