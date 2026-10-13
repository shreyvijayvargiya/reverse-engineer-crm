import type { Row, Stat } from "./types";
import { formatCurrency } from "./utils";

export function computeStat(stat: Stat, rows: Row[]): number {
  const w = stat.where;
  const filtered = w
    ? rows.filter((r) => {
        const v = String(r[w.field] ?? "");
        if (w.in && !w.in.includes(v)) return false;
        if (w.notIn && w.notIn.includes(v)) return false;
        return true;
      })
    : rows;
  if (stat.agg === "count") return filtered.length;
  const nums = filtered.map((r) => Number(r[stat.field ?? ""])).filter((n) => Number.isFinite(n));
  if (stat.agg === "sum") return nums.reduce((a, b) => a + b, 0);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

export function formatStat(stat: Stat, value: number, currency: string): string {
  if (stat.format === "currency") return formatCurrency(value, currency);
  if (stat.format === "decimal") return value.toFixed(1);
  return new Intl.NumberFormat().format(Math.round(value));
}
