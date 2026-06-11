import { describe, expect, it } from "vitest";
import { matchScore, rankJobs, scoreBand } from "./scoring";
import type { ScoreCandidateInput, ScoreJobInput } from "./types";

const cand = (over: Partial<ScoreCandidateInput> = {}): ScoreCandidateInput => ({
  name: "Test Candidate",
  yearsExp: 5,
  skills: [],
  certifications: [],
  ...over,
});

const job = (over: Partial<ScoreJobInput> = {}): ScoreJobInput => ({
  minYears: 5,
  skills: [],
  ...over,
});

/** Prototype seed job j1 (Plant Manager – Cement). */
const plantManager: ScoreJobInput = {
  minYears: 10,
  skills: [
    { skill: "Plant Operations", weight: 3 },
    { skill: "Kiln Management", weight: 3 },
    { skill: "Safety Compliance", weight: 2 },
    { skill: "Team Leadership", weight: 2 },
    { skill: "Budgeting", weight: 1 },
  ],
};

/** Prototype seed candidate c1 (Alex Miller). */
const alex: ScoreCandidateInput = {
  name: "Alex Miller",
  yearsExp: 14,
  skills: [
    { skill: "Plant Operations", years: 14 },
    { skill: "Kiln Management", years: 11 },
    { skill: "Safety Compliance", years: 9 },
    { skill: "Team Leadership", years: 10 },
    { skill: "Budgeting", years: 6 },
  ],
  certifications: ["ISO 45001 Lead Auditor", "Six Sigma Black Belt"],
};

/** Prototype seed candidate c6 (Maria Santos) — partial match, no kiln skill. */
const maria: ScoreCandidateInput = {
  name: "Maria Santos",
  yearsExp: 9,
  skills: [
    { skill: "Plant Operations", years: 9 },
    { skill: "Safety Compliance", years: 7 },
    { skill: "Team Leadership", years: 6 },
    { skill: "Budgeting", years: 5 },
  ],
  certifications: ["Six Sigma Green Belt"],
};

describe("matchScore", () => {
  it("scores a perfect candidate 100", () => {
    const result = matchScore(
      cand({
        yearsExp: 2,
        skills: [{ skill: "Plant Operations", years: 2 }],
        certifications: ["A", "B", "C"],
      }),
      job({ minYears: 2, skills: [{ skill: "Plant Operations", weight: 1 }] }),
    );
    expect(result.score).toBe(100);
    expect(result.cons).toEqual([]);
    expect(result.gaps).toEqual([]);
  });

  it("reproduces the prototype's score for Alex Miller vs Plant Manager (99)", () => {
    // skills: all five at full ratio = 110/110; experience 20/20;
    // certs min(2*2,6)=4/6 → 134/136 → 98.53 → 99
    const result = matchScore(alex, plantManager);
    expect(result.score).toBe(99);
    expect(result.pros[0]).toBe("Plant Operations: 14 yrs experience (exceeds requirement)");
    expect(result.pros).toContain("14 yrs total experience vs 10 required");
    expect(result.pros).toContain(
      "Certifications: ISO 45001 Lead Auditor, Six Sigma Black Belt",
    );
    expect(result.gaps).toEqual([]);
    expect(result.edge).toBe(
      "Alex's strongest edge: 14 years of Plant Operations, backed by ISO 45001 Lead Auditor.",
    );
  });

  it("scores a partial match with gaps and cons (Maria Santos vs Plant Manager = 73)", () => {
    // skills: 30 + 20 + 20 + 9.1667 (Budgeting 5/6 ratio) of 110 (Kiln missing);
    // experience 18/20; certs 2/6 → 99.1667/136 → 72.9 → 73
    const result = matchScore(maria, plantManager);
    expect(result.score).toBe(73);
    expect(result.gaps).toEqual(["Kiln Management"]);
    expect(result.cons).toContain("No demonstrated Kiln Management experience");
    expect(result.cons).toContain("Only 9 yrs total experience (10 required)");
    // Budgeting ratio 5/6 < 1 → no "(exceeds requirement)" suffix
    expect(result.pros).toContain("Budgeting: 5 yrs experience");
  });

  it("matches skill names case-insensitively", () => {
    const result = matchScore(
      cand({ skills: [{ skill: "sap pm", years: 5 }] }),
      job({ skills: [{ skill: "SAP PM", weight: 2 }] }),
    );
    expect(result.gaps).toEqual([]);
    expect(result.pros[0]).toBe("SAP PM: 5 yrs experience (exceeds requirement)");
  });

  it("scores zero skill overlap low, with full cons/gaps wording", () => {
    // skill 0/30; experience 20*(4/10)=8/20; no certs → 8/56 → 14
    const result = matchScore(
      cand({ name: "Kevin Tan", yearsExp: 4, skills: [{ skill: "Excel", years: 2 }] }),
      job({ minYears: 10, skills: [{ skill: "Kiln Management", weight: 3 }] }),
    );
    expect(result.score).toBe(14);
    expect(result.cons).toEqual([
      "No demonstrated Kiln Management experience",
      "Only 4 yrs total experience (10 required)",
    ]);
    expect(result.gaps).toEqual(["Kiln Management"]);
    expect(result.edge).toBe("Kevin's strongest edge: 2 years of Excel.");
  });

  it("caps the certification bonus at 6 points", () => {
    const base = { yearsExp: 1, skills: [] };
    const j = job({ minYears: 1 });
    const three = matchScore(cand({ ...base, certifications: ["a", "b", "c"] }), j);
    const four = matchScore(cand({ ...base, certifications: ["a", "b", "c", "d"] }), j);
    const one = matchScore(cand({ ...base, certifications: ["a"] }), j);
    expect(three.score).toBe(100); // 26/26
    expect(four.score).toBe(100); // still capped at 6
    expect(one.score).toBe(85); // 22/26 → 84.6 → 85
  });

  it("penalizes missing certifications via the denominator", () => {
    // no certs: 20/26 → 76.9 → 77 (the 6 cert points still count against you)
    const result = matchScore(cand({ yearsExp: 1 }), job({ minYears: 1 }));
    expect(result.score).toBe(77);
  });

  it("does not produce NaN when the job requires 0 years", () => {
    // skill ratio denominator floors at 1; experience component awards full 20
    const result = matchScore(
      cand({ yearsExp: 0, skills: [{ skill: "Excel", years: 1 }] }),
      job({ minYears: 0, skills: [{ skill: "Excel", weight: 2 }] }),
    );
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBe(87); // (20 + 20)/46 → 86.95 → 87
  });

  it("returns an empty edge for a candidate with no listed skills", () => {
    const result = matchScore(cand({ skills: [] }), job());
    expect(result.edge).toBe("");
  });

  it("omits ', backed by' from the edge when there are no certifications", () => {
    const result = matchScore(
      cand({ name: "Sarah Jenkins", skills: [{ skill: "Blasting", years: 7 }] }),
      job(),
    );
    expect(result.edge).toBe("Sarah's strongest edge: 7 years of Blasting.");
  });

  it("lands exactly on the green boundary (80) for a hand-computed fixture", () => {
    // skill 30*(0.5+0.5*(4/6))=25; experience 20; no certs → 45/56 → 80.36 → 80
    const result = matchScore(
      cand({ yearsExp: 10, skills: [{ skill: "Blasting", years: 4 }] }),
      job({ minYears: 10, skills: [{ skill: "Blasting", weight: 3 }] }),
    );
    expect(result.score).toBe(80);
    expect(scoreBand(result.score)).toBe("high");
  });
});

describe("scoreBand (green ≥80, amber 60–79, red <60)", () => {
  it.each([
    [100, "high"],
    [80, "high"],
    [79, "mid"],
    [60, "mid"],
    [59, "low"],
    [0, "low"],
  ] as const)("scoreBand(%i) → %s", (score, band) => {
    expect(scoreBand(score)).toBe(band);
  });
});

describe("rankJobs", () => {
  it("orders jobs best match first and preserves the job objects", () => {
    const blastingJob = {
      id: "good",
      minYears: 5,
      skills: [{ skill: "Blasting", weight: 3 as const }],
    };
    const kilnJob = {
      id: "bad",
      minYears: 10,
      skills: [{ skill: "Kiln Management", weight: 3 as const }],
    };
    const blaster = cand({ yearsExp: 8, skills: [{ skill: "Blasting", years: 8 }] });

    const ranked = rankJobs(blaster, [kilnJob, blastingJob]);
    expect(ranked.map((r) => r.job.id)).toEqual(["good", "bad"]);
    expect(ranked[0]!.match.score).toBeGreaterThan(ranked[1]!.match.score);
  });
});
