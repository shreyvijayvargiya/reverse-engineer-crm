import type { Blueprint, Entity, Field } from "../blueprint/schema.js";

export type SeedRow = Record<string, string | number | boolean>;
export type SeedData = Record<string, SeedRow[]>;

const FIRST = ["Aarav", "Maya", "Liam", "Sofia", "Noah", "Priya", "Ethan", "Zara", "Omar", "Chloe", "Rohan", "Emma", "Kenji", "Lucia", "Daniel", "Amara"];
const LAST = ["Patel", "Garcia", "Nguyen", "Smith", "Khan", "Rossi", "Brown", "Singh", "Lopez", "Tanaka", "Cohen", "Silva", "Meyer", "Adeyemi", "Kim", "Dubois"];
const COMPANIES = ["Northwind", "Bluebird Labs", "Harbor & Co", "Greenfield", "Lumen Studio", "Apex Retail", "Orbit Health", "Pine Street", "Sunrise Foods", "Vertex Works"];
const SOURCES_URL = ["https://example.com/listing/", "https://example.org/item/", "https://shop.example.net/p/"];
const SENTENCES = [
  "Asked for a callback after 5pm.",
  "Prefers WhatsApp over email.",
  "Interested in the annual plan.",
  "Referred by an existing customer.",
  "Needs a quote before the end of the month.",
  "Follow up after the next review.",
];
const COMMENTS = [
  "Really smooth experience, would recommend.",
  "Waited longer than expected, but the staff were friendly.",
  "Great value. Booking again next month.",
  "The process was confusing at first.",
  "Excellent service from start to finish.",
  "Pricing was not what I expected.",
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const pick = <T>(arr: T[], i: number) => arr[i % arr.length];

function isoDate(base: Date, offsetDays: number): string {
  const d = new Date(base.getTime() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}
function isoDateTime(base: Date, offsetDays: number, hour: number): string {
  const d = new Date(base.getTime() + offsetDays * 86400000);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

function personName(i: number): string {
  return `${pick(FIRST, i * 3 + 1)} ${pick(LAST, i * 5 + 2)}`;
}

function valueFor(field: Field, entity: Entity, i: number, rnd: () => number, today: Date): string | number | boolean {
  const k = field.key.toLowerCase();
  const person = personName(i);
  switch (field.type) {
    case "email":
      return `${person.toLowerCase().replace(/\s+/g, ".")}@example.com`;
    case "phone":
      return `+1 555 01${String(10 + ((i * 7) % 90)).padStart(2, "0")}`;
    case "url":
      return `${pick(SOURCES_URL, i)}${1000 + i}`;
    case "currency":
      return Math.round((300 + rnd() * 9000) / 10) * 10;
    case "number": {
      if (field.default !== undefined && Number(field.default) === 0) return 0;
      if (/probab/.test(k)) return pick([10, 25, 40, 60, 80, 95], i);
      if (/minute|duration/.test(k)) return pick([30, 45, 60], i);
      return Math.round(rnd() * 100);
    }
    case "rating":
      return pick([5, 4, 5, 3, 4, 2, 5, 4], i);
    case "boolean":
      return i % 4 !== 3;
    case "date": {
      if (/due|close|expire|end/.test(k)) return isoDate(today, -10 + ((i * 6) % 40));
      if (/birth/.test(k)) return isoDate(today, -(9000 + i * 700));
      return isoDate(today, -((i * 5) % 45));
    }
    case "datetime": {
      if (/start|scheduled/.test(k)) return isoDateTime(today, -3 + (i % 12), 9 + (i % 8));
      return isoDateTime(today, -((i * 3) % 30), 10 + (i % 6));
    }
    case "select":
    case "status":
      return pick(field.options ?? [""], i + (hash(field.key) % 3));
    case "tags":
      return "";
    case "longtext": {
      if (/comment|review|feedback/.test(k)) return pick(COMMENTS, i);
      if (/message|body/.test(k)) return "Hi, thanks for being with us. Reply to this message if you have any questions.";
      return pick(SENTENCES, i);
    }
    case "text":
    default: {
      if (field.samples?.length) return pick(field.samples, i);
      if (/number$/.test(k)) return `INV-${String(1001 + i)}`;
      if (/company|organisation|organization|employer/.test(k)) return pick(COMPANIES, i);
      if (/^name$|customer|client|requester|contact|patient|member|student|owner|assignee|buyer/.test(k)) return person;
      if (/job|scraper/.test(k)) return `Job ${1 + (i % 4)}`;
      if (/service|plan|program|insurance/.test(k)) return pick(["Standard", "Premium", "Basic"], i);
      return `${field.label} ${i + 1}`;
    }
  }
}

export function seedBlueprint(bp: Blueprint, now = new Date()): SeedData {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const data: SeedData = {};
  for (const m of bp.modules) {
    for (const e of m.entities) {
      const rnd = mulberry32(hash(e.key));
      const count = e.seedCount ?? 10;
      const rows: SeedRow[] = [];
      for (let i = 0; i < count; i++) {
        const row: SeedRow = { id: `${e.key}-${i + 1}` };
        for (const f of e.fields) row[f.key] = valueFor(f, e, i, rnd, today);
        rows.push(row);
      }
      data[e.key] = coherence(e, rows, today);
    }
  }
  return data;
}

/** Small fix-ups so seeded data reads plausibly (paid invoices have no overdue date, sent campaigns have counts...). */
function coherence(e: Entity, rows: SeedRow[], today: Date): SeedRow[] {
  const has = (k: string) => e.fields.some((f) => f.key === k);
  return rows.map((r, i) => {
    const row = { ...r };
    if (e.key === "invoices" && has("dueDate") && has("issueDate")) {
      row.issueDate = isoDate(today, -(5 + ((i * 7) % 50)));
      row.dueDate = isoDate(today, -(5 + ((i * 7) % 50)) + 30);
      if (row.status === "Overdue") row.dueDate = isoDate(today, -(2 + (i % 12)));
      row.paymentLink = "";
    }
    if ((e.key === "broadcasts" || e.key === "emailCampaigns") && row.status !== "Sent") {
      row.sent = 0;
      row.failed = 0;
      if ("delivered" in row) row.delivered = 0;
      if ("read" in row) row.read = 0;
      if ("opened" in row) row.opened = 0;
      if ("clicked" in row) row.clicked = 0;
      if ("sentAt" in row) row.sentAt = "";
    } else if (e.key === "broadcasts" || e.key === "emailCampaigns") {
      const sent = 80 + ((i * 37) % 400);
      row.sent = sent;
      row.failed = Math.round(sent * 0.03);
      if ("delivered" in row) row.delivered = sent - Number(row.failed);
      if ("read" in row) row.read = Math.round(sent * 0.62);
      if ("opened" in row) row.opened = Math.round(sent * 0.41);
      if ("clicked" in row) row.clicked = Math.round(sent * 0.09);
    }
    if (e.key === "feedback" && has("sentiment") && has("rating")) {
      const rating = Number(row.rating);
      row.sentiment = rating >= 4 ? "Positive" : rating === 3 ? "Neutral" : "Negative";
    }
    if (e.key === "scrapers") {
      row.records = row.status === "Idle" ? 0 : 40 + ((i * 53) % 400);
      if (row.status === "Idle") row.lastRun = "";
    }
    return row;
  });
}
