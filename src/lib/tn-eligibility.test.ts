import { describe, expect, it } from "vitest";
import {
  LEGAL_REVIEW_PENDING,
  TN_REQUIRED_DOCS,
  USMCA_OCCUPATIONS,
  isTnEligible,
} from "./tn-eligibility";

describe("isTnEligible — exact occupation matches", () => {
  it.each([
    ["Mining Engineer", "Engineer (Mining)"],
    ["Metallurgical Engineer", "Engineer (Metallurgical)"],
    ["Chemical Engineer", "Engineer (Chemical)"],
    ["Civil Engineer", "Engineer (Civil)"],
    ["Industrial Engineer", "Engineer (Industrial)"],
    ["Mechanical Engineer", "Engineer (Mechanical)"],
    ["Geologist", "Geologist"],
    ["Geophysicist", "Geophysicist"],
    ["Chemist", "Scientist (Chemistry)"],
    ["Management Consultant", "Management Consultant"],
  ] as const)("%j → exact, eligible, occupation %j", (title, occupation) => {
    const r = isTnEligible(title);
    expect(r.eligible).toBe(true);
    expect(r.confidence).toBe("exact");
    expect(r.matchedOccupation).toBe(occupation);
  });

  it("is case- and whitespace-insensitive", () => {
    const r = isTnEligible("  mINING   engineer ");
    expect(r.confidence).toBe("exact");
    expect(r.matchedOccupation).toBe("Engineer (Mining)");
  });
});

describe("isTnEligible — keyword (non-exact) matches", () => {
  it("matches a sub-discipline keyword on a longer title", () => {
    const r = isTnEligible("Senior Reliability Engineer, Cement");
    expect(r.eligible).toBe(true);
    expect(r.confidence).toBe("keyword");
    expect(r.matchedOccupation).toBe("Engineer (Mechanical)");
  });

  it("keyword matches always require legal review (independent of the interlock)", () => {
    const r = isTnEligible("Process Engineer");
    expect(r.confidence).toBe("keyword");
    expect(r.legalReviewRequired).toBe(true);
  });
});

describe("isTnEligible — no match", () => {
  it.each([
    "Plant Manager",
    "Quarry Supervisor",
    "Procurement Lead",
    "",
    "   ",
  ])("%j → none, not eligible", (title) => {
    const r = isTnEligible(title);
    expect(r.eligible).toBe(false);
    expect(r.confidence).toBe("none");
    expect(r.matchedOccupation).toBeNull();
  });
});

describe("isTnEligible — non-professional trade titles", () => {
  it.each(["Plant Operator", "Field Technician", "Welder", "General Labourer", "Heavy Equipment Mechanic"])(
    "%j → not eligible but flagged for review",
    (title) => {
      const r = isTnEligible(title);
      expect(r.eligible).toBe(false);
      expect(r.legalReviewRequired).toBe(true);
    },
  );
});

describe("legal-review interlock", () => {
  it("forces legalReviewRequired on EVERY result while LEGAL_REVIEW_PENDING", () => {
    expect(LEGAL_REVIEW_PENDING).toBe(true);
    const samples = [
      "Mining Engineer", // exact
      "Reliability Engineer", // keyword
      "Plant Manager", // none
      "Plant Operator", // non-professional
      "", // blank
    ];
    for (const title of samples) {
      expect(isTnEligible(title).legalReviewRequired).toBe(true);
    }
  });
});

describe("TN_REQUIRED_DOCS checklist", () => {
  it("covers support letter, credential evaluation, passport copy and I-94", () => {
    const categories = TN_REQUIRED_DOCS.map((d) => d.category);
    expect(categories).toEqual([
      "tn_support_letter",
      "credential_evaluation",
      "passport_copy",
      "i94_record",
    ]);
  });

  it("every required-doc category is a real USMCA occupation-independent constant", () => {
    expect(TN_REQUIRED_DOCS.length).toBeGreaterThan(0);
    for (const doc of TN_REQUIRED_DOCS) {
      expect(doc.label.length).toBeGreaterThan(0);
      expect(doc.hint.length).toBeGreaterThan(0);
    }
  });
});

describe("USMCA_OCCUPATIONS coverage", () => {
  it("includes the heavy-industry engineering disciplines plus geo/science/consulting", () => {
    const names = USMCA_OCCUPATIONS.map((o) => o.name);
    expect(names).toContain("Engineer (Mining)");
    expect(names).toContain("Engineer (Metallurgical)");
    expect(names).toContain("Engineer (Chemical)");
    expect(names).toContain("Geologist");
    expect(names).toContain("Geophysicist");
    expect(names).toContain("Management Consultant");
  });
});
