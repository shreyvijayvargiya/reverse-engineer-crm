import { describe, expect, it } from "vitest";
import { applyAdjustments, interview } from "../src/agent/interview.js";
import { planOffline } from "../src/plan/offline.js";

describe("interview", () => {
  const base = planOffline("I run a dental clinic");

  it("adds and removes modules and tools with +/-", () => {
    const { brief, unknown } = applyAdjustments(base, "-feedback +tickets +stripe -nonsense bad");
    expect(brief.modules.map((m) => m.id)).toContain("tickets");
    expect(brief.modules.map((m) => m.id)).not.toContain("feedback");
    expect(brief.tools).toContain("stripe");
    expect(unknown).toEqual(["-nonsense", "bad"]);
  });

  it("non-interactive mode accepts the first plan without asking", async () => {
    let asked = 0;
    const brief = await interview(async () => base, { ask: async () => (asked++, ""), say: () => {} }, false);
    expect(asked).toBe(0);
    expect(brief).toBe(base);
  });

  it("asks clarifying questions once, then re-plans with the answers", async () => {
    const calls: unknown[] = [];
    const answers = ["a"];
    const plan = async (a?: { question: string; answer: string }[]) => {
      calls.push(a);
      return a ? { ...base, clarifyingQuestions: [] } : { ...base, clarifyingQuestions: ["What do you sell?"] };
    };
    const io = { ask: async () => answers.shift() ?? "", say: () => {} };
    await interview(plan, io, true);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual([{ question: "What do you sell?", answer: "a" }]);
  });
});
