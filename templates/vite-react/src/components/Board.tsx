import { useState } from "react";
import type { Entity, Row } from "../lib/types";
import { cn } from "../lib/utils";
import { CellValue } from "./fields";
import { Badge, toneFor } from "./ui";

export function Board({
  entity, rows, currency, onMove, onOpen,
}: {
  entity: Entity;
  rows: Row[];
  currency: string;
  onMove: (id: string, value: string) => void;
  onOpen: (row: Row) => void;
}) {
  const [over, setOver] = useState<string | null>(null);
  const boardField = entity.fields.find((f) => f.key === entity.boardField);
  if (!boardField) return null;
  const show = entity.fields.filter((f) => !f.hidden && f.key !== entity.titleField && f.key !== boardField.key).slice(0, 2);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {(boardField.options ?? []).map((option, i) => {
        const col = rows.filter((r) => r[boardField.key] === option);
        return (
          <div
            key={option}
            onDragOver={(e) => { e.preventDefault(); setOver(option); }}
            onDragLeave={() => setOver((o) => (o === option ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/plain");
              if (id) onMove(id, option);
            }}
            className={cn("w-64 shrink-0 rounded-lg border border-border bg-muted/50 p-2", over === option && "ring-2 ring-primary/50")}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <Badge tone={toneFor(option, i)}>{option}</Badge>
              <span className="text-xs text-muted-foreground">{col.length}</span>
            </div>
            <div className="space-y-2">
              {col.map((r) => (
                <button
                  key={r.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
                  onClick={() => onOpen(r)}
                  className="w-full cursor-grab rounded-md border border-border bg-card p-3 text-left text-sm shadow-sm hover:border-primary/50 active:cursor-grabbing"
                >
                  <div className="font-medium">{String(r[entity.titleField] ?? "Untitled")}</div>
                  {show.map((f) => (
                    <div key={f.key} className="mt-1 text-xs text-muted-foreground">
                      <CellValue field={f} value={r[f.key]} currency={currency} />
                    </div>
                  ))}
                </button>
              ))}
              {col.length === 0 && <div className="px-1 py-4 text-center text-xs text-muted-foreground">Drop here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
