import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODULE_IDS } from "../src/catalog/modules.js";
import { TOOL_IDS } from "../src/catalog/tools.js";
import { generate } from "../src/generate/index.js";
import { seedBlueprint } from "../src/generate/seed.js";
import { addModule, expandBrief } from "../src/plan/expand.js";
import { planOffline } from "../src/plan/offline.js";

const NOW = new Date("2026-01-15T12:00:00Z");
const tmp = () => mkdtempSync(join(tmpdir(), "rcrm-gen-"));
const bpFor = (desc: string) => expandBrief(planOffline(desc));

describe("generate", () => {
  it("writes the app, services, openapi and agent docs", () => {
    const out = tmp();
    const bp = bpFor("I run a dental clinic with WhatsApp reminders and Stripe invoices");
    generate(bp, { outDir: out, now: NOW });
    for (const f of [
      "package.json",
      "blueprint.json",
      "src/main.tsx",
      "src/routes.tsx",
      "src/generated/blueprint.ts",
      "src/generated/seed.ts",
      "src/services/stripe.ts",
      "src/services/whatsapp-cloud.ts",
      "src/pages/modules/whatsapp-bulk.tsx",
      "openapi.yaml",
      "AGENTS.md",
      "INTEGRATIONS.md",
      ".env.example",
    ])
      expect(existsSync(join(out, f)), f).toBe(true);
    const openapi = readFileSync(join(out, "openapi.yaml"), "utf8");
    expect(openapi).toContain("/stripe/createPaymentLink");
    expect(openapi).toContain("/whatsapp-cloud/sendBroadcast");
    expect(readFileSync(join(out, "src/services/stripe.ts"), "utf8")).toContain("STRIPE_SECRET_KEY");
    expect(readFileSync(join(out, ".env.example"), "utf8")).toMatch(/^VITE_API_BASE_URL=$/m);
  });

  it("refuses a non-empty directory unless forced", () => {
    const out = tmp();
    writeFileSync(join(out, "keep.txt"), "mine");
    expect(() => generate(bpFor("a crm"), { outDir: out })).toThrow(/not empty/);
    generate(bpFor("a crm"), { outDir: out, force: true });
    expect(readFileSync(join(out, "keep.txt"), "utf8")).toBe("mine");
  });

  it("regenerate refreshes managed files and never touches edited ones", () => {
    const out = tmp();
    let bp = bpFor("a crm for leads");
    generate(bp, { outDir: out, now: NOW });

    // User takes ownership of one page and edits a static runtime file.
    const page = join(out, "src/pages/modules/contacts.tsx");
    writeFileSync(page, "// my own page\nexport default function P(){return null}\n");
    const ui = join(out, "src/components/ui.tsx");
    writeFileSync(ui, readFileSync(ui, "utf8") + "\n// user edit\n");

    bp = addModule(bp, "invoices");
    writeFileSync(join(out, "blueprint.json"), JSON.stringify(bp));
    const report = generate(bp, { outDir: out, update: true, now: NOW });

    expect(existsSync(join(out, "src/pages/modules/invoices.tsx"))).toBe(true);
    expect(readFileSync(page, "utf8")).toContain("my own page");
    expect(readFileSync(ui, "utf8")).toContain("// user edit");
    expect(report.kept).toContain("src/pages/modules/contacts.tsx");
    expect(readFileSync(join(out, "src/routes.tsx"), "utf8")).toContain("InvoicesPage");
  });

  it("seed data is deterministic and plausible", () => {
    const bp = expandBrief({ ...planOffline("x"), modules: MODULE_IDS.map((id) => ({ id, label: id, singular: id })), tools: [], extraFields: [], customEntities: [] });
    const a = seedBlueprint(bp, NOW);
    expect(JSON.stringify(seedBlueprint(bp, NOW))).toBe(JSON.stringify(a));
    for (const inv of a.invoices) {
      if (inv.status === "Overdue") expect(String(inv.dueDate) < "2026-01-15").toBe(true);
      expect(inv.paymentLink).toBe("");
    }
    for (const b of a.broadcasts) if (b.status !== "Sent") expect(b.sent).toBe(0);
    for (const f of a.feedback) expect(["Positive", "Neutral", "Negative"]).toContain(f.sentiment);
  });

  it("works with every tool selected", () => {
    const out = tmp();
    const bp = expandBrief({ ...planOffline("x"), modules: MODULE_IDS.map((id) => ({ id, label: id, singular: id })), tools: TOOL_IDS, extraFields: [], customEntities: [] });
    generate(bp, { outDir: out, now: NOW });
    for (const id of TOOL_IDS) expect(existsSync(join(out, `src/services/${id}.ts`)), id).toBe(true);
  });

  it("supabase mode emits schema with RLS on", () => {
    const out = tmp();
    generate({ ...bpFor("leads and deals"), dataLayer: "supabase" }, { outDir: out });
    const sql = readFileSync(join(out, "supabase/schema.sql"), "utf8");
    expect(sql).toContain("enable row level security");
  });
});
