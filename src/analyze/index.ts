import { extname } from "node:path";
import { analyzeCsv } from "./csv.js";
import { analyzeHar } from "./har.js";
import type { Evidence } from "./types.js";

export * from "./types.js";

export function analyzeFile(path: string, opts: { includeValues?: boolean } = {}): Evidence {
  const ext = extname(path).toLowerCase();
  if (ext === ".csv") return analyzeCsv(path, opts);
  if (ext === ".har") return analyzeHar(path);
  throw new Error(`Unsupported input "${path}". Supported: .csv (export from your current tool), .har (your own browser session).`);
}

/** Compact text for the planner prompt. Contains structure only, never row values (beyond category labels). */
export function evidenceToText(evidence: Evidence[]): string {
  return evidence
    .map((ev) => {
      if (ev.kind === "csv") {
        const cols = ev.columns
          .map((c) => `- ${c.name} (${c.type}${c.values ? `; values: ${c.values.join(" | ")}` : ""})`)
          .join("\n");
        return `CSV "${ev.file}" (${ev.rowCount} rows):\n${cols}`;
      }
      const eps = ev.endpoints
        .map((e) => `- ${e.method} ${e.path} -> ${e.status}${e.isList ? " (list)" : ""}${e.shape ? " {" + Object.entries(e.shape).map(([k, t]) => `${k}:${t}`).join(", ") + "}" : ""}`)
        .join("\n");
      return `HAR "${ev.file}" (host ${ev.host}):\n${eps}`;
    })
    .join("\n\n");
}
