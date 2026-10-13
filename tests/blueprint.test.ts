import { describe, expect, it } from "vitest";
import { MODULE_DEFS, MODULE_IDS } from "../src/catalog/modules.js";
import { CATEGORIES, TOOLS } from "../src/catalog/tools.js";
import { addModule, addTool, expandBrief, removeModule, removeTool, validateBlueprint } from "../src/plan/expand.js";
import { planOffline } from "../src/plan/offline.js";

const brief = (modules: string[], tools: string[] = []) => ({
  ...planOffline("x"),
  modules: modules.map((id) => ({ id, label: id, singular: id })),
  extraFields: [],
  customEntities: [],
  tools,
});

describe("catalog integrity", () => {
  it("every module expands into a valid blueprint on its own", () => {
    for (const id of MODULE_IDS) expect(() => expandBrief(brief([id])), id).not.toThrow();
  });
  it("all modules together are valid and entity keys are unique", () => {
    const bp = expandBrief(brief(MODULE_IDS));
    const keys = bp.modules.flatMap((m) => m.entities.map((e) => e.key));
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("every action slot is a known tool category with at least one tool", () => {
    for (const def of MODULE_DEFS)
      for (const e of def.module.entities)
        for (const a of e.actions)
          for (const slot of a.slots) {
            expect(CATEGORIES[slot as keyof typeof CATEGORIES], `${a.id} -> ${slot}`).toBeDefined();
            expect(TOOLS.some((t) => t.category === slot)).toBe(true);
          }
  });
  it("tool ids are unique and every category has a tool", () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
    for (const c of Object.keys(CATEGORIES)) expect(TOOLS.some((t) => t.category === c), c).toBe(true);
  });
  it("modules that need contacts pull it in", () => {
    const bp = expandBrief(brief(["whatsapp_bulk"]));
    expect(bp.modules.map((m) => m.id)).toContain("contacts");
  });
});

describe("expand and edit", () => {
  it("fills a default tool only for core actions", () => {
    expect(expandBrief(brief(["scrapers"])).primaryTools.scraping).toBe("apify");
    expect(Object.keys(expandBrief(brief(["feedback"])).primaryTools)).toEqual([]);
  });
  it("keeps the user's tool pick over the default", () => {
    expect(expandBrief(brief(["scrapers"], ["firecrawl"])).primaryTools.scraping).toBe("firecrawl");
  });
  it("sanitises custom entities and extra fields", () => {
    const b = brief(["contacts"]);
    b.extraFields = [{ module: "contacts", key: "Date Of Birth!", label: "DOB", type: "date", options: [] }];
    b.customEntities = [
      { key: "Vehicle Log", label: "Vehicle", plural: "Vehicles", fields: [{ key: "Plate No", label: "Plate", type: "text", options: [] }, { key: "state", label: "State", type: "status", options: [] }] },
    ];
    const bp = expandBrief(b);
    const contacts = bp.modules.find((m) => m.id === "contacts")!.entities[0];
    expect(contacts.fields.some((f) => f.key === "dateOfBirth")).toBe(true);
    const custom = bp.modules.find((m) => m.id === "custom")!.entities[0];
    expect(custom.key).toBe("vehicleLog");
    expect(custom.boardField).toBe("state");
    expect(custom.fields.find((f) => f.key === "state")!.options!.length).toBeGreaterThan(0);
  });
  it("addModule / removeModule / addTool / removeTool", () => {
    let bp = expandBrief(brief(["contacts"]));
    bp = addModule(bp, "whatsapp_bulk");
    expect(bp.modules.map((m) => m.id)).toContain("whatsapp_bulk");
    expect(addModule(bp, "whatsapp_bulk")).toEqual(bp);
    expect(() => removeModule(bp, "contacts")).toThrow(/required by/);
    bp = removeModule(bp, "whatsapp_bulk");
    expect(bp.modules.map((m) => m.id)).not.toContain("whatsapp_bulk");
    bp = addTool(bp, "slack");
    expect(bp.tools).toContain("slack");
    bp = removeTool(bp, "slack");
    expect(bp.tools).not.toContain("slack");
  });
  it("rejects a blueprint with a dangling boardField", () => {
    const bp = expandBrief(brief(["contacts"]));
    const bad = structuredClone(bp);
    bad.modules[0].entities[0].boardField = "name";
    expect(() => validateBlueprint(bad)).toThrow(/boardField/);
  });
});
