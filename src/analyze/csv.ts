import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { FieldType } from "../blueprint/schema.js";
import type { CsvEvidence } from "./types.js";

/** Minimal RFC 4180 parser: quotes, escaped quotes, CRLF, embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+$/i;
const PHONE = /^\+?[\d\s().-]{7,18}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const MONEY = /^[$€£₹]\s?-?[\d,]+(\.\d+)?$/;
const NUMBER = /^-?[\d,]+(\.\d+)?$/;
const BOOL = /^(true|false|yes|no|y|n)$/i;

export function inferType(name: string, values: string[]): FieldType {
  const v = values.filter((x) => x !== "");
  if (v.length === 0) return "text";
  const all = (re: RegExp) => v.every((x) => re.test(x.trim()));
  const n = name.toLowerCase();
  if (all(EMAIL)) return "email";
  if (all(URL_RE)) return "url";
  if (all(DATETIME)) return "datetime";
  if (all(DATE)) return "date";
  if (all(MONEY)) return "currency";
  if (all(BOOL)) return "boolean";
  if (all(PHONE) && /phone|mobile|tel|whatsapp|contact/.test(n)) return "phone";
  if (all(NUMBER)) {
    if (/price|amount|total|value|revenue|cost|fee/.test(n)) return "currency";
    if (/rating|stars|score/.test(n) && v.every((x) => Number(x) >= 0 && Number(x) <= 5)) return "rating";
    return "number";
  }
  const avgLen = v.reduce((s, x) => s + x.length, 0) / v.length;
  if (avgLen > 80) return "longtext";
  const distinct = new Set(v.map((x) => x.trim()));
  const named = /status|stage|state|phase/.test(n) ? "status" : /priority|type|category|source|channel|segment|tier/.test(n) ? "select" : null;
  // A column named like a category needs only some repetition; anything else needs clear repetition.
  if (named && v.length >= 4 && distinct.size <= 8 && distinct.size < v.length) return named;
  if (v.length >= 6 && distinct.size <= 8 && distinct.size < v.length / 2) return "select";
  return "text";
}

export function analyzeCsv(path: string, opts: { includeValues?: boolean } = {}): CsvEvidence {
  const rows = parseCsv(readFileSync(path, "utf8"));
  if (rows.length < 2) throw new Error(`${path}: needs a header row and at least one data row`);
  const [header, ...data] = rows;
  const sample = data.slice(0, 200);
  const includeValues = opts.includeValues ?? true;
  return {
    kind: "csv",
    file: basename(path),
    rowCount: data.length,
    columns: header.map((name, i) => {
      const col = sample.map((r) => (r[i] ?? "").trim());
      const type = inferType(name, col);
      const filled = col.filter((x) => x !== "").length;
      const evidence = {
        name: name.trim() || `column${i + 1}`,
        type,
        filledRatio: sample.length ? Math.round((filled / sample.length) * 100) / 100 : 0,
      };
      if (includeValues && (type === "select" || type === "status")) {
        return { ...evidence, values: [...new Set(col.filter(Boolean))].slice(0, 8) };
      }
      return evidence;
    }),
  };
}
