import { describe, expect, it } from "vitest";

import { computeScore } from "@/domain/prequal/score";
import type {
  PrequalQuestion,
  PrequalScoringRules,
} from "@/domain/loaders/prequal";

// Pure unit tests — no DB, no I/O. Covers all 6 question types, gating
// detection, and score-band edge cases.

const emptyRules: PrequalScoringRules = {
  passThreshold: 0,
  gatingFailValues: {},
};

describe("computeScore — point types", () => {
  it("yes_no awards weight on true, 0 on false", () => {
    const t = {
      questionsJson: [
        { key: "q1", label: "Insured?", type: "yes_no", required: true, weight: 10 },
      ] as PrequalQuestion[],
      scoringRules: emptyRules,
    };
    expect(computeScore(t, { q1: true }).scoreTotal).toBe(10);
    expect(computeScore(t, { q1: false }).scoreTotal).toBe(0);
    expect(computeScore(t, {}).scoreTotal).toBe(0);
  });

  it("number matches scoreBands inclusively at boundaries", () => {
    const t = {
      questionsJson: [
        {
          key: "yrs",
          label: "Years",
          type: "number",
          required: true,
          scoreBands: [
            { min: 0, max: 2, points: 0 },
            { min: 3, max: 5, points: 5 },
            { min: 6, max: 999, points: 10 },
          ],
        },
      ] as PrequalQuestion[],
      scoringRules: emptyRules,
    };
    expect(computeScore(t, { yrs: 2 }).scoreTotal).toBe(0);
    expect(computeScore(t, { yrs: 3 }).scoreTotal).toBe(5);
    expect(computeScore(t, { yrs: 5 }).scoreTotal).toBe(5);
    expect(computeScore(t, { yrs: 6 }).scoreTotal).toBe(10);
    expect(computeScore(t, { yrs: 1000 }).scoreTotal).toBe(0);
    expect(computeScore(t, {}).scoreTotal).toBe(0);
  });

  it("select_one looks up option points", () => {
    const t = {
      questionsJson: [
        {
          key: "safety",
          label: "Safety",
          type: "select_one",
          required: true,
          options: [
            { key: "none", label: "None", points: 0 },
            { key: "basic", label: "Basic", points: 5 },
            { key: "comprehensive", label: "Comprehensive", points: 15 },
          ],
        },
      ] as PrequalQuestion[],
      scoringRules: emptyRules,
    };
    expect(computeScore(t, { safety: "comprehensive" }).scoreTotal).toBe(15);
    expect(computeScore(t, { safety: "basic" }).scoreTotal).toBe(5);
    expect(computeScore(t, { safety: "unknown" }).scoreTotal).toBe(0);
  });

  it("multi_select sums points for each selected option", () => {
    const t = {
      questionsJson: [
        {
          key: "certs",
          label: "Certs",
          type: "multi_select",
          required: false,
          options: [
            { key: "c10", label: "C-10", points: 4 },
            { key: "c45", label: "C-45", points: 6 },
            { key: "c61", label: "C-61", points: 3 },
          ],
        },
      ] as PrequalQuestion[],
      scoringRules: emptyRules,
    };
    expect(computeScore(t, { certs: ["c10", "c45"] }).scoreTotal).toBe(10);
    expect(computeScore(t, { certs: ["c10", "c45", "c61"] }).scoreTotal).toBe(13);
    expect(computeScore(t, { certs: [] }).scoreTotal).toBe(0);
    expect(computeScore(t, {}).scoreTotal).toBe(0);
  });

  it("short_text and long_text always score 0", () => {
    const t = {
      questionsJson: [
        { key: "nm", label: "Name", type: "short_text", required: true, weight: 99 },
        { key: "nt", label: "Notes", type: "long_text", required: false, weight: 99 },
      ] as PrequalQuestion[],
      scoringRules: emptyRules,
    };
    expect(
      computeScore(t, { nm: "Acme Corp", nt: "Long answer here" }).scoreTotal,
    ).toBe(0);
  });

  it("sums across multiple questions", () => {
    const t = {
      questionsJson: [
        { key: "ins", label: "Insured", type: "yes_no", required: true, weight: 10 },
        {
          key: "yrs",
          label: "Years",
          type: "number",
          required: true,
          scoreBands: [{ min: 0, max: 999, points: 5 }],
        },
        {
          key: "safety",
          label: "Safety",
          type: "select_one",
          required: true,
          options: [{ key: "ok", label: "OK", points: 3 }],
        },
      ] as PrequalQuestion[],
      scoringRules: emptyRules,
    };
    const r = computeScore(t, { ins: true, yrs: 8, safety: "ok" });
    expect(r.scoreTotal).toBe(18);
  });
});

describe("computeScore — gating", () => {
  const t = {
    questionsJson: [
      {
        key: "bk",
        label: "Bankruptcy?",
        type: "yes_no",
        required: true,
        weight: 0,
        gating: true,
      },
      {
        key: "lit",
        label: "Active litigation?",
        type: "yes_no",
        required: true,
        weight: 0,
        gating: true,
      },
      {
        key: "cs",
        label: "Crew size",
        type: "number",
        required: true,
        scoreBands: [{ min: 1, max: 100, points: 5 }],
      },
    ] as PrequalQuestion[],
    scoringRules: {
      passThreshold: 0,
      gatingFailValues: { bk: true, lit: true },
    } as PrequalScoringRules,
  };

  it("flags gating fail when answer matches fail value", () => {
    const r = computeScore(t, { bk: true, lit: false, cs: 10 });
    expect(r.gatingFailures).toEqual(["bk"]);
    expect(r.scoreTotal).toBe(5);
  });

  it("flags multiple gating fails", () => {
    const r = computeScore(t, { bk: true, lit: true, cs: 10 });
    expect(r.gatingFailures.sort()).toEqual(["bk", "lit"]);
  });

  it("clean answers produce no gating fails", () => {
    const r = computeScore(t, { bk: false, lit: false, cs: 10 });
    expect(r.gatingFailures).toEqual([]);
  });

  it("missing gating answer is not a fail (only an explicit match triggers)", () => {
    const r = computeScore(t, { cs: 10 });
    expect(r.gatingFailures).toEqual([]);
  });

  it("supports array fail values for multi_select gating", () => {
    const arrT = {
      questionsJson: [
        {
          key: "violations",
          label: "Past violations",
          type: "multi_select",
          required: false,
          gating: true,
          options: [
            { key: "wage", label: "Wage", points: 0 },
            { key: "safety", label: "Safety", points: 0 },
            { key: "fraud", label: "Fraud", points: 0 },
          ],
        },
      ] as PrequalQuestion[],
      scoringRules: {
        passThreshold: 0,
        gatingFailValues: { violations: ["fraud"] },
      } as PrequalScoringRules,
    };
    expect(
      computeScore(arrT, { violations: ["safety"] }).gatingFailures,
    ).toEqual([]);
    expect(
      computeScore(arrT, { violations: ["safety", "fraud"] }).gatingFailures,
    ).toEqual(["violations"]);
  });
});
