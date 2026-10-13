import type { Field, Row } from "./types";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function modulePath(id: string): string {
  return `/${id.replace(/_/g, "-")}`;
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowLocalIso(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function formatCurrency(value: unknown, currency: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${currency} ${Math.round(n)}`;
  }
}

export function formatDate(value: unknown): string {
  if (!value) return "-";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value: unknown): string {
  if (!value) return "-";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function defaultRow(fields: Field[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.default === "today") out[f.key] = todayIso();
    else if (f.default !== undefined) out[f.key] = f.type === "number" || f.type === "currency" ? Number(f.default) : f.default;
    else if (f.type === "select" || f.type === "status") out[f.key] = f.options?.[0] ?? "";
    else if (f.type === "boolean") out[f.key] = false;
    else if (f.type === "number" || f.type === "currency" || f.type === "rating") out[f.key] = 0;
    else out[f.key] = "";
  }
  return out;
}

export function toCsv(rows: Row[], fields: Field[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = fields.map((f) => esc(f.label)).join(",");
  const body = rows.map((r) => fields.map((f) => esc(r[f.key])).join(","));
  return [head, ...body].join("\n");
}

export function download(filename: string, text: string, mime = "text/csv"): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
