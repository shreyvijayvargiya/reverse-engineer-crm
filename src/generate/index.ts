import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { Blueprint } from "../blueprint/schema.js";
import { TOOLS, getTool, type ToolDef } from "../catalog/tools.js";
import { renderAgents, renderIntegrations, renderReadme } from "./render/docs.js";
import { MARKER, kebab } from "./render/names.js";
import { renderOpenApi } from "./render/openapi.js";
import { renderService, renderServicesIndex } from "./render/services.js";
import {
  renderBlueprintTs,
  renderEnvExample,
  renderModulePage,
  renderPackageJson,
  renderRoutes,
  renderSeedTs,
  renderSupabaseSchema,
} from "./render/misc.js";
import { seedBlueprint } from "./seed.js";

const TEMPLATE_ROOT = fileURLToPath(new URL("../../templates/vite-react", import.meta.url));

export interface GenerateOptions {
  outDir: string;
  /** Allow writing into a non-empty directory (existing files are never deleted). */
  force?: boolean;
  /** Refresh an existing generated repo: only files that still carry the marker are overwritten. */
  update?: boolean;
  now?: Date;
}

export interface GenerateReport {
  outDir: string;
  written: string[];
  kept: string[];
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function generate(bp: Blueprint, opts: GenerateOptions): GenerateReport {
  const { outDir } = opts;
  const exists = existsSync(outDir);
  const nonEmpty = exists && readdirSync(outDir).length > 0;
  if (nonEmpty && !opts.force && !opts.update) {
    throw new Error(`${outDir} is not empty. Use --force to write into it (existing files are kept), or pick another --out.`);
  }
  if (opts.update && !existsSync(join(outDir, "blueprint.json"))) {
    throw new Error(`${outDir} has no blueprint.json. Run this from a generated repo, or use --dir.`);
  }
  mkdirSync(outDir, { recursive: true });

  const report: GenerateReport = { outDir, written: [], kept: [] };
  const write = (rel: string, content: string, mode: "static" | "managed") => {
    const target = join(outDir, rel);
    if (existsSync(target)) {
      if (mode === "static") {
        report.kept.push(rel);
        return;
      }
      if (!readFileSync(target, "utf8").includes(MARKER)) {
        report.kept.push(rel);
        return;
      }
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
    report.written.push(rel);
  };

  // Static runtime: copied once, then yours.
  for (const file of walk(TEMPLATE_ROOT)) {
    const rel = relative(TEMPLATE_ROOT, file);
    let content = readFileSync(file, "utf8");
    if (rel === "index.html") content = content.replace("{{name}}", esc(bp.name)).replace("{{description}}", esc(bp.description));
    write(rel, content, "static");
  }
  write("package.json", renderPackageJson(bp), "static");
  write(".gitignore", "node_modules\ndist\n.env\n.env.local\n.DS_Store\n", "static");

  // Source of truth. In update mode the caller already wrote it.
  if (!opts.update) writeFileSync(join(outDir, "blueprint.json"), JSON.stringify(bp, null, 2) + "\n");

  // Managed: derived from the blueprint, refreshed on regenerate.
  const tools = bp.tools.map((id) => getTool(id)).filter((t): t is ToolDef => Boolean(t));
  write("src/generated/blueprint.ts", renderBlueprintTs(bp), "managed");
  write("src/generated/seed.ts", renderSeedTs(seedBlueprint(bp, opts.now)), "managed");
  write("src/routes.tsx", renderRoutes(bp), "managed");
  for (const m of bp.modules) write(`src/pages/modules/${kebab(m.id)}.tsx`, renderModulePage(m.id), "managed");
  for (const t of tools) write(`src/services/${t.id}.ts`, renderService(t), "managed");
  write("src/services/index.ts", renderServicesIndex(tools, bp.primaryTools), "managed");
  write("openapi.yaml", renderOpenApi(bp), "managed");
  write(".env.example", renderEnvExample(bp), "managed");
  write("README.md", renderReadme(bp), "managed");
  write("AGENTS.md", renderAgents(bp), "managed");
  write("INTEGRATIONS.md", renderIntegrations(bp), "managed");
  if (bp.dataLayer === "supabase") write("supabase/schema.sql", renderSupabaseSchema(bp), "managed");

  return report;
}

export { TOOLS };
