import { Check, Minus } from "lucide-react";
import type { Field } from "../lib/types";
import { formatCurrency, formatDate, formatDateTime } from "../lib/utils";
import { Badge, Input, Select, Stars, Textarea, toneFor } from "./ui";

export function CellValue({ field, value, currency }: { field: Field; value: unknown; currency: string }) {
  const empty = value === undefined || value === null || value === "";
  switch (field.type) {
    case "currency":
      return <>{formatCurrency(value, currency)}</>;
    case "date":
      return <>{formatDate(value)}</>;
    case "datetime":
      return <>{formatDateTime(value)}</>;
    case "status":
      return empty ? <>-</> : <Badge tone={toneFor(String(value), field.options?.indexOf(String(value)) ?? 0)}>{String(value)}</Badge>;
    case "select":
      return empty ? <>-</> : <Badge>{String(value)}</Badge>;
    case "rating":
      return <Stars value={Number(value) || 0} />;
    case "boolean":
      return value ? <Check className="h-4 w-4 text-emerald-500" aria-label="Yes" /> : <Minus className="h-4 w-4 text-muted-foreground" aria-label="No" />;
    case "email":
      return empty ? <>-</> : <a className="text-primary hover:underline" href={`mailto:${value}`}>{String(value)}</a>;
    case "phone":
      return empty ? <>-</> : <a className="text-primary hover:underline" href={`tel:${value}`}>{String(value)}</a>;
    case "url":
      return empty ? <>-</> : (
        <a className="text-primary hover:underline" href={String(value)} target="_blank" rel="noreferrer">
          {String(value).replace(/^https?:\/\//, "").slice(0, 32)}
        </a>
      );
    case "longtext":
      return <span className="line-clamp-1 max-w-[260px]">{empty ? "-" : String(value)}</span>;
    case "number":
      return <>{empty ? "-" : String(value)}</>;
    default:
      return <>{empty ? "-" : String(value)}</>;
  }
}

export function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const str = value === undefined || value === null ? "" : String(value);
  switch (field.type) {
    case "longtext":
      return <Textarea value={str} onChange={(e) => onChange(e.target.value)} />;
    case "select":
    case "status":
      return (
        <Select value={str} onChange={(e) => onChange(e.target.value)}>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </Select>
      );
    case "number":
    case "currency":
      return <Input type="number" value={str} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
    case "rating":
      return <Stars value={Number(value) || 0} onChange={onChange} />;
    case "boolean":
      return (
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
          Yes
        </label>
      );
    case "date":
      return <Input type="date" value={str} onChange={(e) => onChange(e.target.value)} />;
    case "datetime":
      return <Input type="datetime-local" value={str} onChange={(e) => onChange(e.target.value)} />;
    case "email":
      return <Input type="email" value={str} onChange={(e) => onChange(e.target.value)} />;
    case "phone":
      return <Input type="tel" value={str} onChange={(e) => onChange(e.target.value)} />;
    case "url":
      return <Input type="url" placeholder="https://" value={str} onChange={(e) => onChange(e.target.value)} />;
    default:
      return <Input value={str} onChange={(e) => onChange(e.target.value)} />;
  }
}
