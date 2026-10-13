import { createInterface } from "node:readline/promises";
import type { Brief } from "../blueprint/brief.js";
import { MODULE_DEFS, MODULE_IDS } from "../catalog/modules.js";
import { TOOL_IDS, getTool } from "../catalog/tools.js";

export type Planner = (answers?: { question: string; answer: string }[]) => Promise<Brief>;

export interface InterviewIO {
  ask: (question: string) => Promise<string>;
  say: (line: string) => void;
}

export function terminalIO(): InterviewIO & { close: () => void } {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    ask: (q) => rl.question(q),
    say: (l) => console.log(l),
    close: () => rl.close(),
  };
}

export function showPlan(brief: Brief, say: (l: string) => void) {
  say(`\n${brief.name}  (${brief.vertical})`);
  say(brief.description);
  say("\nPages:");
  for (const m of brief.modules) {
    const def = MODULE_DEFS.find((d) => d.module.id === m.id);
    say(`  ${m.id.padEnd(16)} ${m.label.padEnd(22)} ${def?.pitch ?? ""}`);
  }
  for (const c of brief.customEntities) say(`  (custom)         ${c.plural}`);
  say("\nTools:");
  if (brief.tools.length === 0) say("  (defaults will be filled in for the actions above)");
  for (const t of brief.tools) say(`  ${t.padEnd(16)} ${getTool(t)?.name ?? ""}`);
  say(`\nWhy: ${brief.rationale}`);
}

/** "-tickets +invoices +stripe -slack": module ids and tool ids share one syntax. */
export function applyAdjustments(brief: Brief, line: string): { brief: Brief; unknown: string[] } {
  const next: Brief = structuredClone(brief);
  const unknown: string[] = [];
  for (const tok of line.split(/[\s,]+/).filter(Boolean)) {
    const sign = tok[0];
    const id = tok.slice(1);
    if (sign !== "+" && sign !== "-") {
      unknown.push(tok);
      continue;
    }
    if (MODULE_IDS.includes(id)) {
      if (sign === "+" && !next.modules.some((m) => m.id === id)) {
        const def = MODULE_DEFS.find((d) => d.module.id === id)!.module;
        next.modules.push({ id, label: def.label, singular: def.entities[0].label });
      }
      if (sign === "-") next.modules = next.modules.filter((m) => m.id !== id);
    } else if (TOOL_IDS.includes(id)) {
      if (sign === "+" && !next.tools.includes(id)) next.tools.push(id);
      if (sign === "-") next.tools = next.tools.filter((t) => t !== id);
    } else unknown.push(tok);
  }
  next.extraFields = next.extraFields.filter((x) => next.modules.some((m) => m.id === x.module));
  return { brief: next, unknown };
}

/**
 * Propose, then adjust. Asks the model's clarifying questions only when it has them, then lets the user
 * tweak the plan once. `interactive: false` accepts the first plan.
 */
export async function interview(plan: Planner, io: InterviewIO, interactive: boolean): Promise<Brief> {
  let brief = await plan();
  if (!interactive) return brief;

  if (brief.clarifyingQuestions.length > 0) {
    const answers: { question: string; answer: string }[] = [];
    for (const q of brief.clarifyingQuestions.slice(0, 3)) {
      const answer = (await io.ask(`? ${q}\n> `)).trim();
      if (answer) answers.push({ question: q, answer });
    }
    brief = await plan(answers);
  }

  showPlan(brief, io.say);
  for (;;) {
    const line = (
      await io.ask(`\nAdjust with +id / -id (modules or tools), e.g. "-tickets +invoices +stripe". Enter to accept: `)
    ).trim();
    if (!line) return brief;
    const { brief: next, unknown } = applyAdjustments(brief, line);
    if (unknown.length) io.say(`Ignored (not a known +/-module or tool id): ${unknown.join(", ")}`);
    if (next.modules.length === 0 && next.customEntities.length === 0) {
      io.say("A CRM needs at least one module. Keeping the previous plan.");
      continue;
    }
    brief = next;
    showPlan(brief, io.say);
  }
}
