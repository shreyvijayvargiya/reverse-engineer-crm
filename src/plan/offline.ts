import type { Evidence } from "../analyze/types.js";
import { ACCENTS, type FieldType } from "../blueprint/schema.js";
import type { Brief } from "../blueprint/brief.js";
import { MODULE_DEFS } from "../catalog/modules.js";
import { TOOLS, type ToolDef } from "../catalog/tools.js";
import { camelKey } from "./expand.js";

/**
 * Deterministic planner used with --offline and in tests. No network, no model: keyword scoring plus a few
 * vertical presets. The Claude planner is better at ambiguous descriptions; this is the safety net.
 */

interface VerticalPreset {
  match: RegExp;
  vertical: string;
  plural: string;
  singular: string;
  modules: string[];
  extraFields: Brief["extraFields"];
  accent: (typeof ACCENTS)[number];
}

const VERTICALS: VerticalPreset[] = [
  {
    match: /\b(dent\w*|clinic|doctor|hospital|physio\w*|therap\w*|medical|orthodont\w*)\b/,
    vertical: "clinic",
    plural: "Patients",
    singular: "Patient",
    modules: ["contacts", "appointments", "invoices", "feedback"],
    extraFields: [
      { module: "contacts", key: "dateOfBirth", label: "Date of birth", type: "date", options: [] },
      { module: "contacts", key: "insuranceProvider", label: "Insurance provider", type: "text", options: [] },
    ],
    accent: "sky",
  },
  {
    match: /\b(gym|fitness|yoga|pilates|crossfit|studio)\b/,
    vertical: "fitness studio",
    plural: "Members",
    singular: "Member",
    modules: ["contacts", "appointments", "invoices", "feedback"],
    extraFields: [{ module: "contacts", key: "membershipPlan", label: "Membership plan", type: "select", options: ["Monthly", "Quarterly", "Annual"] }],
    accent: "emerald",
  },
  {
    match: /\b(real estate|realtor|property|properties|broker\w*|letting)\b/,
    vertical: "real estate agency",
    plural: "Buyers & sellers",
    singular: "Buyer or seller",
    modules: ["contacts", "deals", "appointments", "tasks"],
    extraFields: [{ module: "contacts", key: "budget", label: "Budget", type: "currency", options: [] }],
    accent: "amber",
  },
  {
    match: /\b(agency|freelanc\w*|consult\w*|studio services)\b/,
    vertical: "agency",
    plural: "Clients",
    singular: "Client",
    modules: ["contacts", "deals", "tasks", "invoices"],
    extraFields: [],
    accent: "violet",
  },
  {
    match: /\b(e-?commerce|online store|shop|retail|dtc)\b/,
    vertical: "online store",
    plural: "Customers",
    singular: "Customer",
    modules: ["contacts", "tickets", "feedback", "email_campaigns"],
    extraFields: [{ module: "contacts", key: "lifetimeValue", label: "Lifetime value", type: "currency", options: [] }],
    accent: "rose",
  },
  {
    match: /\b(salon|spa|barber\w*|beauty)\b/,
    vertical: "salon",
    plural: "Clients",
    singular: "Client",
    modules: ["contacts", "appointments", "invoices", "feedback"],
    extraFields: [],
    accent: "rose",
  },
  {
    match: /\b(school|tutor\w*|coaching|academy|course|students?)\b/,
    vertical: "education business",
    plural: "Students",
    singular: "Student",
    modules: ["contacts", "appointments", "invoices", "feedback"],
    extraFields: [{ module: "contacts", key: "program", label: "Program", type: "text", options: [] }],
    accent: "indigo",
  },
];

function hasWord(text: string, kw: string): boolean {
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Allow simple inflections: email -> emails/emailing, scrape -> scraper/scraping.
  return new RegExp(`(^|[^a-z0-9])${esc}(s|es|ing|ed|er|ers)?([^a-z0-9]|$)`, "i").test(text);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function evidenceToEntities(evidence: Evidence[]): Brief["customEntities"] {
  const out: Brief["customEntities"] = [];
  for (const ev of evidence) {
    if (ev.kind === "csv") {
      const stem = ev.file.replace(/\.[^.]+$/, "");
      out.push({
        key: camelKey(stem),
        label: titleCase(stem.replace(/[-_]+/g, " ")),
        plural: titleCase(stem.replace(/[-_]+/g, " ")),
        fields: ev.columns.map((c) => ({
          key: camelKey(c.name),
          label: c.name,
          type: c.type,
          options: c.values ?? [],
        })),
      });
    } else {
      for (const ep of ev.endpoints.filter((e) => e.isList && e.shape && e.method === "GET").slice(0, 4)) {
        const seg = ep.path.split("/").filter((s) => s && s !== "{id}").pop() ?? "records";
        const typeOf = (t: string): FieldType => (t === "number" ? "number" : t === "boolean" ? "boolean" : "text");
        out.push({
          key: camelKey(seg),
          label: titleCase(seg.replace(/[-_]+/g, " ")),
          plural: titleCase(seg.replace(/[-_]+/g, " ")),
          fields: Object.entries(ep.shape!)
            .filter(([, t]) => t !== "array" && t !== "object")
            .slice(0, 12)
            .map(([k, t]) => ({ key: camelKey(k), label: titleCase(k.replace(/[_-]+/g, " ")), type: typeOf(t), options: [] })),
        });
      }
    }
  }
  // De-duplicate keys across sources.
  const seen = new Set<string>();
  return out.filter((e) => e.fields.length > 0 && !seen.has(e.key) && (seen.add(e.key), true));
}

/** Brand match only. Generic words ("email", "sms") are handled by modules + category defaults. */
function brandOf(t: ToolDef): string {
  if (t.id === "cal-com") return "cal.com";
  if (t.id === "discord-webhook") return "discord";
  if (t.id.startsWith("twilio")) return "twilio";
  if (t.id.startsWith("google-")) return t.name.toLowerCase();
  return t.id;
}

function pickTools(text: string, moduleIds: Set<string>): string[] {
  const picked: string[] = [];
  const groups = new Map<string, ToolDef[]>();
  for (const t of TOOLS) {
    const brand = brandOf(t);
    if (hasWord(text, brand)) groups.set(brand, [...(groups.get(brand) ?? []), t]);
  }
  for (const variants of groups.values()) {
    if (variants.length === 1) {
      picked.push(variants[0].id);
      continue;
    }
    // Same brand, several categories (Twilio SMS vs WhatsApp): choose by what the text and modules say.
    const wantsWhatsapp = hasWord(text, "whatsapp");
    const wantsSms = hasWord(text, "sms");
    const v =
      (wantsSms && variants.find((x) => x.category === "sms")) ||
      (wantsWhatsapp && variants.find((x) => x.category === "whatsapp")) ||
      (moduleIds.has("whatsapp_bulk") && variants.find((x) => x.category === "whatsapp")) ||
      variants[0];
    picked.push(v.id);
  }
  return picked;
}

export function planOffline(description: string, evidence: Evidence[] = []): Brief {
  const text = description.toLowerCase();
  const scores = new Map<string, number>();
  for (const def of MODULE_DEFS) {
    const hits = def.keywords.filter((k) => hasWord(text, k)).length;
    if (hits > 0) scores.set(def.module.id, hits);
  }

  const preset = VERTICALS.find((v) => v.match.test(text));
  if (preset) for (const id of preset.modules) scores.set(id, (scores.get(id) ?? 0) + 1);

  // "whatsapp" and "sms" both mean the messaging module.
  const ids = MODULE_DEFS.map((d) => d.module.id).filter((id) => scores.has(id));
  const onlyScraping = ids.length === 1 && ids[0] === "scrapers";
  if (!onlyScraping && !ids.includes("contacts")) ids.unshift("contacts");
  if (ids.length === 0) ids.push("contacts", "deals", "tasks");

  const vocab = preset ?? null;
  const modules = ids.map((id) => {
    const def = MODULE_DEFS.find((d) => d.module.id === id)!.module;
    const e = def.entities[0];
    if (id === "contacts" && vocab) return { id, label: vocab.plural, singular: vocab.singular };
    return { id, label: def.label, singular: e.label };
  });

  const vertical = preset?.vertical ?? (text.match(/\b(?:run|own|manage|have)\s+(?:a|an|my)?\s*([a-z][a-z -]{2,30}?)(?:\s+(?:and|where|that|which|business)\b|[,.]|$)/)?.[1]?.trim() || "business");
  const name =
    !preset && modules.length === 1 && modules[0].id !== "contacts" ? `${modules[0].label} dashboard`.replace(/\b\w/g, (c) => c.toUpperCase()) : `${titleCase(vertical)} CRM`;

  return {
    name,
    description: description.trim().slice(0, 240),
    vertical,
    accent: preset?.accent ?? ACCENTS[hash(name) % ACCENTS.length],
    modules,
    extraFields: preset?.extraFields.filter((x) => ids.includes(x.module)) ?? [],
    customEntities: evidenceToEntities(evidence),
    tools: pickTools(text, new Set(ids)),
    clarifyingQuestions: [],
    rationale: "Offline planner: matched keywords and vertical presets. Use the Claude planner for ambiguous workflows.",
  };
}
