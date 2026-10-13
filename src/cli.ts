#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { analyzeFile, evidenceToText, type Evidence } from "./analyze/index.js";
import { PlannerError, planWithClaude } from "./agent/claude.js";
import { interview, terminalIO } from "./agent/interview.js";
import type { Blueprint } from "./blueprint/schema.js";
import { MODULE_DEFS, MODULE_IDS } from "./catalog/modules.js";
import { CATEGORIES, TOOLS, TOOL_IDS } from "./catalog/tools.js";
import { generate, type GenerateReport } from "./generate/index.js";
import { addModule, addTool, expandBrief, removeModule, removeTool, slugify, validateBlueprint } from "./plan/expand.js";
import { planOffline } from "./plan/offline.js";

const HELP = `rcrm: describe what you do online, get a CRM / dashboard codebase you own.

Usage
  rcrm generate "<what you do>" [--out dir] [--from file ...] [options]
  rcrm from-blueprint <blueprint.json> [--out dir]
  rcrm regenerate [--dir .]
  rcrm add <module-or-tool-id ...> [--dir .]
  rcrm remove <module-or-tool-id ...> [--dir .]
  rcrm analyze <file.csv|file.har>
  rcrm modules | tools
  rcrm validate <blueprint.json>

generate options
  --out <dir>          Output directory (default ./<slug>)
  --from <file>        CSV export or HAR from your own tool/session (repeatable)
  --no-values          Don't send category labels from CSV columns to the planner
  --offline            Skip Claude; use the keyword planner (no network)
  --model <id>         Claude model (default claude-opus-5-5, or RCRM_MODEL)
  --yes                Don't ask questions; accept the first plan
  --data-layer <x>     local | supabase | firebase | api (default local)
  --currency <ISO>     Default USD
  --blueprint-only     Write <out>/blueprint.json and stop
  --force              Write into a non-empty directory (never deletes files)

Privacy: with Claude planning, your description and the *structure* of any --from files (column names,
types, endpoint shapes) are sent to the Anthropic API. Row values and HAR headers/bodies are never read
into the prompt. Use --offline to keep everything local.
`;

function fail(message: string): never {
  console.error(`rcrm: ${message}`);
  process.exit(1);
}

function printReport(r: GenerateReport, bp: Blueprint) {
  console.log(`\nGenerated ${bp.name} in ${r.outDir}`);
  console.log(`  ${r.written.length} files written${r.kept.length ? `, ${r.kept.length} kept (existing or edited)` : ""}`);
  console.log(`  modules: ${bp.modules.map((m) => m.id).join(", ")}`);
  console.log(`  tools:   ${bp.tools.join(", ") || "none"}`);
  console.log(`\nNext:\n  cd ${r.outDir}\n  npm install\n  npm run dev\n`);
}

function readBlueprint(file: string): Blueprint {
  if (!existsSync(file)) fail(`${file} not found`);
  try {
    return validateBlueprint(JSON.parse(readFileSync(file, "utf8")));
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
}

async function cmdGenerate(args: string[], v: Record<string, any>) {
  const description = args.join(" ").trim();
  if (!description && !(v.from as string[] | undefined)?.length) fail('give a description, e.g. rcrm generate "I run a dental clinic"');

  const evidence: Evidence[] = [];
  for (const f of (v.from as string[] | undefined) ?? []) {
    try {
      const ev = analyzeFile(resolve(f), { includeValues: !v["no-values"] });
      evidence.push(ev);
      console.log(`Read ${ev.kind.toUpperCase()} structure from ${ev.file}`);
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }
  const evidenceText = evidence.length ? evidenceToText(evidence) : undefined;
  const desc = description || "Build a CRM for the data in the attached files.";
  const interactive = Boolean(process.stdin.isTTY) && !v.yes;

  const plan = v.offline
    ? async () => planOffline(desc, evidence)
    : async (answers?: { question: string; answer: string }[]) =>
        planWithClaude({ description: desc, evidenceText, answers, model: v.model });
  if (v.offline) console.log("Offline planner (no model call).");

  const io = terminalIO();
  let brief;
  try {
    brief = await interview(plan, io, interactive);
  } catch (e) {
    io.close();
    if (e instanceof PlannerError) fail(e.message);
    throw e;
  }
  io.close();

  const bp = expandBrief(brief, { dataLayer: v["data-layer"], currency: v.currency });
  const out = resolve(v.out ?? slugify(bp.name));
  if (v["blueprint-only"]) {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "blueprint.json"), JSON.stringify(bp, null, 2) + "\n");
    console.log(`Wrote ${join(out, "blueprint.json")}`);
    return;
  }
  printReport(generate(bp, { outDir: out, force: v.force }), bp);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: "string" },
      dir: { type: "string" },
      from: { type: "string", multiple: true },
      "no-values": { type: "boolean" },
      offline: { type: "boolean" },
      model: { type: "string" },
      yes: { type: "boolean", short: "y" },
      "data-layer": { type: "string" },
      currency: { type: "string" },
      "blueprint-only": { type: "boolean" },
      force: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [cmd, ...rest] = positionals;
  if (!cmd || values.help) {
    console.log(HELP);
    return;
  }

  if (values["data-layer"] && !["local", "supabase", "firebase", "api"].includes(values["data-layer"] as string))
    fail("--data-layer must be local, supabase, firebase or api");

  switch (cmd) {
    case "generate":
      return cmdGenerate(rest, values as Record<string, any>);

    case "from-blueprint": {
      const file = rest[0] ?? fail("usage: rcrm from-blueprint <blueprint.json> [--out dir]");
      const bp = readBlueprint(resolve(file));
      return printReport(generate(bp, { outDir: resolve(values.out ?? slugify(bp.name)), force: values.force }), bp);
    }

    case "regenerate": {
      const dir = resolve(values.dir ?? ".");
      const bp = readBlueprint(join(dir, "blueprint.json"));
      return printReport(generate(bp, { outDir: dir, update: true }), bp);
    }

    case "add":
    case "remove": {
      if (rest.length === 0) fail(`usage: rcrm ${cmd} <module-or-tool-id ...>`);
      const dir = resolve(values.dir ?? ".");
      let bp = readBlueprint(join(dir, "blueprint.json"));
      for (const id of rest) {
        if (MODULE_IDS.includes(id)) bp = cmd === "add" ? addModule(bp, id) : removeModule(bp, id);
        else if (TOOL_IDS.includes(id)) bp = cmd === "add" ? addTool(bp, id) : removeTool(bp, id);
        else fail(`unknown id "${id}". See \`rcrm modules\` and \`rcrm tools\`.`);
      }
      writeFileSync(join(dir, "blueprint.json"), JSON.stringify(bp, null, 2) + "\n");
      return printReport(generate(bp, { outDir: dir, update: true }), bp);
    }

    case "analyze": {
      const file = rest[0] ?? fail("usage: rcrm analyze <file.csv|file.har>");
      try {
        console.log(evidenceToText([analyzeFile(resolve(file), { includeValues: !values["no-values"] })]));
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
      }
      return;
    }

    case "modules":
      for (const m of MODULE_DEFS) console.log(`${m.module.id.padEnd(18)} ${m.pitch}`);
      return;

    case "tools":
      for (const c of Object.values(CATEGORIES)) {
        console.log(`\n${c.label} (${c.id})`);
        for (const t of TOOLS.filter((x) => x.category === c.id)) console.log(`  ${t.id.padEnd(18)} ${t.name}`);
      }
      return;

    case "validate": {
      const file = rest[0] ?? fail("usage: rcrm validate <blueprint.json>");
      const bp = readBlueprint(resolve(file));
      console.log(`OK: ${bp.name} (${bp.modules.length} modules, ${bp.tools.length} tools)`);
      return;
    }

    default:
      fail(`unknown command "${cmd}". Run \`rcrm --help\`.`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
