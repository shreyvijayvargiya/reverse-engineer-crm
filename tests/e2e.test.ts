import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODULE_IDS } from "../src/catalog/modules.js";
import { TOOL_IDS } from "../src/catalog/tools.js";
import { generate } from "../src/generate/index.js";
import { expandBrief } from "../src/plan/expand.js";
import { planOffline } from "../src/plan/offline.js";

// Slow: installs dependencies and builds the generated app. Run with `npm run test:e2e`.
describe.skipIf(!process.env.RCRM_E2E)("generated app builds", () => {
  it("every module and tool together typechecks and builds", { timeout: 600_000 }, () => {
    const out = mkdtempSync(join(tmpdir(), "rcrm-e2e-"));
    const bp = expandBrief({
      ...planOffline("x"),
      modules: MODULE_IDS.map((id) => ({ id, label: id, singular: id })),
      tools: TOOL_IDS,
      extraFields: [],
      customEntities: [{ key: "vehicleLog", label: "Vehicle", plural: "Vehicles", fields: [{ key: "plate", label: "Plate", type: "text", options: [] }] }],
    });
    generate(bp, { outDir: out });
    execSync("npm install --no-audit --no-fund", { cwd: out, stdio: "inherit" });
    execSync("npm run build", { cwd: out, stdio: "inherit" });
    expect(true).toBe(true);
  });
});
