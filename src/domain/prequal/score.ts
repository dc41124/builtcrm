import type {
  PrequalQuestion,
  PrequalScoringRules,
} from "@/domain/loaders/prequal";

// Pure score computation — no I/O. Tested independently in
// tests/prequal-scoring.test.ts. Used by `submit-submission.ts` and any
// admin "recompute" path. Score is internal to the contractor; subs never
// see this value (filtered out in the sub loader).
//
// Per-question type points (build guide §sub-step 5):
//   yes_no       → ans === true ? q.weight : 0
//   number       → matching scoreBand.points; 0 if no band matches
//   select_one   → q.options[choiceKey].points
//   multi_select → sum of points for each selected key
//   short_text   → 0 (qualitative)
//   long_text    → 0 (qualitative)
//
// Gating: a question with `gating: true` whose answer matches the
// template's `gatingFailValues[questionKey]` adds its key to the
// gatingFailures array (regardless of points).

function pointsFor(q: PrequalQuestion, ans: unknown): number {
  switch (q.type) {
    case "yes_no":
      return ans === true ? q.weight ?? 0 : 0;
    case "number": {
      if (typeof ans !== "number") return 0;
      if (!Array.isArray(q.scoreBands)) return 0;
      for (const band of q.scoreBands) {
        if (ans >= band.min && ans <= band.max) return band.points;
      }
      return 0;
    }
    case "select_one": {
      if (typeof ans !== "string") return 0;
      const opt = q.options?.find((o) => o.key === ans);
      return opt?.points ?? 0;
    }
    case "multi_select": {
      if (!Array.isArray(ans)) return 0;
      const opts = q.options ?? [];
      let total = 0;
      for (const sel of ans) {
        const opt = opts.find((o) => o.key === sel);
        if (opt?.points) total += opt.points;
      }
      return total;
    }
    case "short_text":
    case "long_text":
      return 0;
  }
}

function matchesGatingFail(
  failValue: string | boolean | string[] | undefined,
  ans: unknown,
): boolean {
  if (failValue === undefined) return false;
  if (Array.isArray(failValue)) {
    if (Array.isArray(ans)) {
      // Any selected option matching a fail value triggers gating.
      return ans.some((a) => failValue.includes(String(a)));
    }
    return failValue.includes(String(ans));
  }
  // Scalar comparison — booleans, strings, numbers all coerce sensibly here.
  return failValue === ans;
}

export function computeScore(
  template: { questionsJson: PrequalQuestion[]; scoringRules: PrequalScoringRules },
  answers: Record<string, unknown>,
): { scoreTotal: number; gatingFailures: string[] } {
  let total = 0;
  const gatingFailures: string[] = [];

  for (const q of template.questionsJson) {
    const ans = answers[q.key];
    if (q.gating) {
      const failValue = template.scoringRules.gatingFailValues[q.key];
      if (matchesGatingFail(failValue, ans)) {
        gatingFailures.push(q.key);
      }
    }
    total += pointsFor(q, ans);
  }

  return { scoreTotal: total, gatingFailures };
}
