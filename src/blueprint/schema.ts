import { z } from "zod";

export const FIELD_TYPES = [
  "text",
  "longtext",
  "email",
  "phone",
  "url",
  "number",
  "currency",
  "date",
  "datetime",
  "select",
  "status",
  "rating",
  "boolean",
  "tags",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const ACCENTS = ["indigo", "emerald", "rose", "amber", "sky", "violet"] as const;

export const ICONS = [
  "users",
  "handshake",
  "check-square",
  "file-text",
  "mail",
  "message-circle",
  "star",
  "globe",
  "calendar",
  "life-buoy",
  "database",
  "package",
  "briefcase",
  "layout-dashboard",
] as const;

export const FieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  label: z.string().min(1),
  type: z.enum(FIELD_TYPES),
  options: z.array(z.string()).optional(),
  default: z.string().optional(),
  samples: z.array(z.string()).optional(),
  hidden: z.boolean().optional(),
});
export type Field = z.infer<typeof FieldSchema>;

export const ActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Tool categories this action can use; the first one present in the blueprint wins. Empty = local only. */
  slots: z.array(z.string()),
  scope: z.enum(["row", "table"]),
  /** Core actions are the point of their module: a default tool is filled in if none was chosen. Others stay hidden until a matching tool is added. */
  core: z.boolean().optional(),
});
export type Action = z.infer<typeof ActionSchema>;

export const EntitySchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  label: z.string(),
  plural: z.string(),
  icon: z.enum(ICONS),
  titleField: z.string(),
  boardField: z.string().optional(),
  fields: z.array(FieldSchema).min(1),
  actions: z.array(ActionSchema),
  seedCount: z.number().int().min(0).max(60).optional(),
});
export type Entity = z.infer<typeof EntitySchema>;

export const StatSchema = z.object({
  label: z.string(),
  entity: z.string(),
  agg: z.enum(["count", "sum", "avg"]),
  field: z.string().optional(),
  where: z
    .object({
      field: z.string(),
      in: z.array(z.string()).optional(),
      notIn: z.array(z.string()).optional(),
    })
    .optional(),
  format: z.enum(["number", "currency", "decimal"]),
});
export type Stat = z.infer<typeof StatSchema>;

export const ModuleSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  icon: z.enum(ICONS),
  entities: z.array(EntitySchema).min(1),
  stats: z.array(StatSchema),
});
export type Module = z.infer<typeof ModuleSchema>;

export const BlueprintSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  description: z.string(),
  vertical: z.string(),
  theme: z.object({ accent: z.enum(ACCENTS) }),
  currency: z.string().length(3),
  stack: z.object({
    framework: z.enum(["vite-react"]),
    styling: z.literal("tailwind"),
    icons: z.literal("lucide"),
  }),
  dataLayer: z.enum(["local", "supabase", "firebase", "api"]),
  modules: z.array(ModuleSchema).min(1),
  /** Every tool that gets a service stub. */
  tools: z.array(z.string()),
  /** One tool per category is wired into the UI; the others keep their stub. */
  primaryTools: z.record(z.string(), z.string()),
});
export type Blueprint = z.infer<typeof BlueprintSchema>;

/** Cross-reference checks zod can't express. Returns a list of human-readable problems. */
export function lintBlueprint(bp: Blueprint): string[] {
  const problems: string[] = [];
  const entityKeys = new Set<string>();
  for (const m of bp.modules) {
    for (const e of m.entities) {
      if (entityKeys.has(e.key)) problems.push(`duplicate entity key "${e.key}"`);
      entityKeys.add(e.key);
      const fieldKeys = new Set(e.fields.map((f) => f.key));
      if (fieldKeys.size !== e.fields.length) problems.push(`entity "${e.key}" has duplicate field keys`);
      if (!fieldKeys.has(e.titleField)) problems.push(`entity "${e.key}": titleField "${e.titleField}" is not a field`);
      if (e.boardField) {
        const bf = e.fields.find((f) => f.key === e.boardField);
        if (!bf || !bf.options?.length) problems.push(`entity "${e.key}": boardField "${e.boardField}" needs a select/status field with options`);
      }
      for (const f of e.fields) {
        if ((f.type === "select" || f.type === "status") && !f.options?.length)
          problems.push(`entity "${e.key}": field "${f.key}" is ${f.type} but has no options`);
      }
    }
  }
  for (const m of bp.modules) {
    for (const s of m.stats) {
      if (!entityKeys.has(s.entity)) problems.push(`stat "${s.label}" references unknown entity "${s.entity}"`);
      if (s.agg !== "count" && !s.field) problems.push(`stat "${s.label}" needs a field for ${s.agg}`);
    }
  }
  for (const [cat, tool] of Object.entries(bp.primaryTools)) {
    if (!bp.tools.includes(tool)) problems.push(`primaryTools.${cat} = "${tool}" is not in tools`);
  }
  return problems;
}
