import {
  type Blueprint,
  type Entity,
  type Field,
  type Module,
  BlueprintSchema,
  lintBlueprint,
} from "../blueprint/schema.js";
import { type Brief, makeBriefSchema } from "../blueprint/brief.js";
import { cloneModule, getModuleDef, MODULE_DEFS, MODULE_IDS, primaryEntity } from "../catalog/modules.js";
import { CATEGORIES, TOOLS, TOOL_IDS, defaultToolFor, getTool } from "../catalog/tools.js";

export const BriefSchema = makeBriefSchema(MODULE_IDS, TOOL_IDS);

export function slugify(s: string): string {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "my-crm";
}

/** "Date of birth" -> "dateOfBirth"; always starts with a letter. */
export function camelKey(s: string): string {
  const parts = s
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "field";
  const joined = parts.map((p, i) => (i === 0 ? p[0].toLowerCase() + p.slice(1) : p[0].toUpperCase() + p.slice(1))).join("");
  return /^[a-z]/.test(joined) ? joined : `f${joined}`;
}

function uniqueKey(base: string, taken: Set<string>): string {
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}${n++}`;
  taken.add(key);
  return key;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sanitizeField(raw: { key: string; label: string; type: Field["type"]; options?: string[] }, taken: Set<string>): Field {
  const key = uniqueKey(camelKey(raw.key || raw.label), taken);
  const needsOptions = raw.type === "select" || raw.type === "status";
  let options = (raw.options ?? []).map((o) => o.trim()).filter(Boolean);
  if (needsOptions && options.length === 0) options = raw.type === "status" ? ["New", "In progress", "Done"] : ["Option 1", "Option 2"];
  const field: Field = { key, label: raw.label || titleCase(key), type: raw.type };
  if (needsOptions) field.options = options;
  return field;
}

function customEntity(raw: Brief["customEntities"][number], takenEntityKeys: Set<string>): Entity {
  const takenFields = new Set<string>();
  const fields = raw.fields.map((fl) => sanitizeField(fl, takenFields));
  if (fields.length === 0) fields.push({ key: "name", label: "Name", type: "text" });
  const titleField = fields.find((x) => x.type === "text")?.key ?? fields[0].key;
  const board = fields.find((x) => x.type === "status");
  return {
    key: uniqueKey(camelKey(raw.key || raw.label), takenEntityKeys),
    label: raw.label,
    plural: raw.plural || `${raw.label}s`,
    icon: "package",
    titleField,
    ...(board ? { boardField: board.key } : {}),
    fields,
    actions: [],
    seedCount: 10,
  };
}

/** Marketing opt-in on contacts when anything messages them; gives the send actions a consent gate. */
function applyCrossModuleRules(modules: Module[]) {
  const ids = new Set(modules.map((m) => m.id));
  const contacts = modules.find((m) => m.id === "contacts");
  const messaging = ids.has("whatsapp_bulk") || ids.has("email_campaigns");
  if (contacts && messaging) {
    const e = primaryEntity(contacts);
    if (!e.fields.some((x) => x.key === "marketingOptIn")) {
      const at = e.fields.findIndex((x) => x.key === "status");
      e.fields.splice(at >= 0 ? at + 1 : e.fields.length, 0, {
        key: "marketingOptIn",
        label: "Marketing opt-in",
        type: "boolean",
      });
    }
  }
}

function ensureRequires(ids: string[]): string[] {
  const out: string[] = [];
  const add = (id: string) => {
    if (out.includes(id) || !getModuleDef(id)) return;
    for (const r of getModuleDef(id)!.requires) add(r);
    out.push(id);
  };
  ids.forEach(add);
  return out;
}

function neededCategories(modules: Module[]): Set<string> {
  const need = new Set<string>();
  for (const m of modules) {
    for (const e of m.entities) {
      for (const a of e.actions) {
        // Alternatives (whatsapp|sms|email): the first slot is the preferred one.
        if (a.slots.length > 0) need.add(a.slots[0]);
      }
    }
  }
  return need;
}

/** Choose primary tool per category: user's picks first, then a default for every category an action needs. */
function resolveTools(modules: Module[], picked: string[]): { tools: string[]; primaryTools: Record<string, string> } {
  const tools = [...new Set(picked.filter((id) => getTool(id)))];
  const primary: Record<string, string> = {};
  for (const id of tools) {
    const cat = getTool(id)!.category;
    if (!primary[cat]) primary[cat] = id;
  }
  const slotsUsed = new Set<string>();
  for (const m of modules) for (const e of m.entities) for (const a of e.actions) a.slots.forEach((s) => slotsUsed.add(s));
  // Alternatives: if any alternative of an action is already covered, don't force the others.
  for (const m of modules) {
    for (const e of m.entities) {
      for (const a of e.actions) {
        if (a.slots.length === 0 || !a.core) continue;
        if (a.slots.some((s) => primary[s])) continue;
        const dflt = defaultToolFor(a.slots[0]);
        if (dflt) {
          tools.push(dflt.id);
          primary[dflt.category] = dflt.id;
        }
      }
    }
  }
  return { tools: [...new Set(tools)], primaryTools: primary };
}

/** Table-level "Export to <sheet tool>" action, added to every entity when a sheets tool is present. */
function applySheetsExport(modules: Module[], primary: Record<string, string>) {
  if (!primary.sheets) return;
  for (const m of modules)
    for (const e of m.entities)
      if (!e.actions.some((a) => a.id === "table.exportSheets"))
        e.actions.push({ id: "table.exportSheets", label: "Export to sheet", slots: ["sheets"], scope: "table" });
}

export interface ExpandOptions {
  dataLayer?: Blueprint["dataLayer"];
  currency?: string;
}

export function expandBrief(brief: Brief, opts: ExpandOptions = {}): Blueprint {
  const wanted = brief.modules.map((m) => m.id);
  const ids = ensureRequires(wanted);
  const modules: Module[] = ids.map((id) => cloneModule(id));

  // Vocabulary overrides land on the module and its primary entity.
  for (const bm of brief.modules) {
    const m = modules.find((x) => x.id === bm.id);
    if (!m) continue;
    const e = primaryEntity(m);
    if (bm.label.trim()) {
      m.label = bm.label.trim();
      e.plural = bm.label.trim();
    }
    if (bm.singular.trim()) e.label = bm.singular.trim();
  }

  // Vertical-specific extra fields.
  for (const xf of brief.extraFields) {
    const m = modules.find((x) => x.id === xf.module);
    if (!m) continue;
    const e = primaryEntity(m);
    const taken = new Set(e.fields.map((x) => x.key));
    e.fields.push(sanitizeField(xf, taken));
  }

  // Custom entities live in one extra module.
  if (brief.customEntities.length > 0) {
    const taken = new Set(modules.flatMap((m) => m.entities.map((e) => e.key)));
    const entities = brief.customEntities.map((c) => customEntity(c, taken));
    modules.push({
      id: "custom",
      label: entities.length === 1 ? entities[0].plural : "Custom data",
      description: "Entities specific to this workflow.",
      icon: "package",
      entities,
      stats: entities.map((e) => ({ label: e.plural, entity: e.key, agg: "count" as const, format: "number" as const })),
    });
  }

  applyCrossModuleRules(modules);
  const { tools, primaryTools } = resolveTools(modules, brief.tools);
  applySheetsExport(modules, primaryTools);

  const bp: Blueprint = {
    version: 1,
    name: brief.name,
    slug: slugify(brief.name),
    description: brief.description,
    vertical: brief.vertical,
    theme: { accent: brief.accent },
    currency: opts.currency ?? "USD",
    stack: { framework: "vite-react", styling: "tailwind", icons: "lucide" },
    dataLayer: opts.dataLayer ?? "local",
    modules,
    tools,
    primaryTools,
  };
  return validateBlueprint(bp);
}

export function validateBlueprint(input: unknown): Blueprint {
  const parsed = BlueprintSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n  ");
    throw new Error(`Invalid blueprint:\n  ${issues}`);
  }
  const problems = lintBlueprint(parsed.data);
  if (problems.length) throw new Error(`Invalid blueprint:\n  ${problems.join("\n  ")}`);
  return parsed.data;
}

/* ------------- incremental edits (used by `rcrm add` / `rcrm remove`) ------------- */

function rebuild(bp: Blueprint, moduleIds: string[], pickedTools: string[]): Blueprint {
  const keep = new Map(bp.modules.map((m) => [m.id, m]));
  const ids = ensureRequires(moduleIds.filter((id) => keep.has(id) || getModuleDef(id)));
  const modules = ids.map((id) => keep.get(id) ?? cloneModule(id));
  // Strip derived bits, then re-derive so edits stay idempotent.
  for (const m of modules) for (const e of m.entities) e.actions = e.actions.filter((a) => a.id !== "table.exportSheets");
  applyCrossModuleRules(modules);
  const { tools, primaryTools } = resolveTools(modules, pickedTools);
  applySheetsExport(modules, primaryTools);
  return validateBlueprint({ ...bp, modules, tools, primaryTools });
}

export function addModule(bp: Blueprint, id: string): Blueprint {
  if (!getModuleDef(id)) throw new Error(`Unknown module "${id}". Known: ${MODULE_IDS.join(", ")}`);
  const ids = bp.modules.map((m) => m.id);
  if (ids.includes(id)) return bp;
  // Keep user's tool choices; resolveTools fills defaults for the new module.
  return rebuild(bp, [...ids, id], preferPrimary(bp));
}

export function removeModule(bp: Blueprint, id: string): Blueprint {
  const ids = bp.modules.map((m) => m.id).filter((x) => x !== id);
  if (ids.length === 0) throw new Error("A CRM needs at least one module.");
  const dependents = bp.modules.filter((m) => getModuleDef(m.id)?.requires.includes(id)).map((m) => m.id);
  if (dependents.length) throw new Error(`Cannot remove "${id}": required by ${dependents.join(", ")}.`);
  return rebuild(bp, ids, bp.tools);
}

export function addTool(bp: Blueprint, id: string): Blueprint {
  const tool = getTool(id);
  if (!tool) throw new Error(`Unknown tool "${id}". Known: ${TOOL_IDS.join(", ")}`);
  if (bp.tools.includes(id)) return bp;
  // A newly added tool becomes primary only if its category has none yet.
  return rebuild(bp, bp.modules.map((m) => m.id), [...preferPrimary(bp), id]);
}

export function removeTool(bp: Blueprint, id: string): Blueprint {
  return rebuild(bp, bp.modules.map((m) => m.id), preferPrimary(bp).filter((t) => t !== id));
}

function preferPrimary(bp: Blueprint): string[] {
  // Primary tools first so they stay primary after rebuild; then the rest.
  const primaries = Object.values(bp.primaryTools);
  return [...primaries, ...bp.tools.filter((t) => !primaries.includes(t))];
}

export function describeCatalog(): { modules: { id: string; pitch: string }[]; tools: { id: string; category: string; name: string }[] } {
  return {
    modules: MODULE_DEFS.map((m) => ({ id: m.module.id, pitch: m.pitch })),
    tools: TOOLS.map((t) => ({ id: t.id, category: t.category, name: t.name })),
  };
}

export { CATEGORIES };
