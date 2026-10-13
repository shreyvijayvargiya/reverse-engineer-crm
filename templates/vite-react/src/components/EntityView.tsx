import { useMemo, useState } from "react";
import { Download, Kanban, Loader2, Pencil, Play, Plus, Search, Table2, Trash2 } from "lucide-react";
import { blueprint } from "../generated/blueprint";
import { resolveSlot, runAction } from "../lib/actions";
import { store, useRows } from "../lib/store";
import type { Action, Entity, Row } from "../lib/types";
import { defaultRow, download, toCsv } from "../lib/utils";
import { Board } from "./Board";
import { CellValue, FieldInput } from "./fields";
import { Button, Card, Dialog, Input, Label, Select, useToast } from "./ui";

export function EntityView({ entity }: { entity: Entity }) {
  const rows = useRows(entity.key);
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<"table" | "board">(entity.boardField ? "board" : "table");
  const [editing, setEditing] = useState<{ row: Row | null; draft: Record<string, unknown> } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const boardField = entity.fields.find((f) => f.key === entity.boardField);
  const columns = entity.fields.filter((f) => !f.hidden);
  // Actions whose tool category isn't configured stay hidden (add a tool with `rcrm add <tool-id>`).
  const available = entity.actions.filter((a) => resolveSlot(a) !== null);
  const rowActions = available.filter((a) => a.scope === "row");
  const tableActions = available.filter((a) => a.scope === "table");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter && boardField && r[boardField.key] !== filter) return false;
      if (!q) return true;
      return entity.fields.some((f) => String(r[f.key] ?? "").toLowerCase().includes(q));
    });
  }, [rows, query, filter, boardField, entity.fields]);

  const open = (row: Row | null) => setEditing({ row, draft: row ? { ...row } : defaultRow(entity.fields) });

  const save = () => {
    if (!editing) return;
    const title = String(editing.draft[entity.titleField] ?? "").trim();
    if (!title) {
      toast(`${entity.fields.find((f) => f.key === entity.titleField)?.label ?? "Title"} is required`, "error");
      return;
    }
    if (editing.row) store.update(entity.key, editing.row.id, editing.draft as Partial<Row>);
    else store.insert(entity.key, editing.draft as Omit<Row, "id">);
    store.log(`${editing.row ? "Updated" : "Added"} ${entity.label.toLowerCase()} "${title}"`);
    setEditing(null);
  };

  const remove = (row: Row) => {
    if (!window.confirm(`Delete "${String(row[entity.titleField] ?? "this record")}"?`)) return;
    store.remove(entity.key, row.id);
    store.log(`Deleted ${entity.label.toLowerCase()}`);
  };

  const run = async (action: Action, row?: Row) => {
    const key = `${action.id}:${row?.id ?? "table"}`;
    setBusy(key);
    await runAction(action, { entity, row, notify: toast });
    setBusy(null);
  };

  const ActionButton = ({ action, row }: { action: Action; row?: Row }) => {
    const key = `${action.id}:${row?.id ?? "table"}`;
    return (
      <Button size="sm" variant="ghost" disabled={busy !== null} title={action.label} onClick={() => run(action, row)}>
        {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        <span className="hidden 2xl:inline">{action.label}</span>
      </Button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder={`Search ${entity.plural.toLowerCase()}`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search" />
        </div>
        {boardField && (
          <Select className="w-auto" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={`Filter by ${boardField.label}`}>
            <option value="">All {boardField.label.toLowerCase()}</option>
            {(boardField.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
          </Select>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {boardField && (
            <div className="flex rounded-md border border-border p-0.5">
              <Button size="sm" variant={view === "board" ? "secondary" : "ghost"} onClick={() => setView("board")} aria-label="Board view"><Kanban className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant={view === "table" ? "secondary" : "ghost"} onClick={() => setView("table")} aria-label="Table view"><Table2 className="h-3.5 w-3.5" /></Button>
            </div>
          )}
          {tableActions.map((a) => <ActionButton key={a.id} action={a} />)}
          <Button size="sm" onClick={() => download(`${entity.key}.csv`, toCsv(visible, entity.fields))}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="primary" onClick={() => open(null)}><Plus className="h-4 w-4" /> New {entity.label.toLowerCase()}</Button>
        </div>
      </div>

      {view === "board" && boardField ? (
        <Board entity={entity} rows={visible} currency={blueprint.currency} onMove={(id, value) => store.update(entity.key, id, { [boardField.key]: value })} onOpen={open} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                {columns.map((f) => <th key={f.key} className="whitespace-nowrap px-4 py-2.5 font-medium">{f.label}</th>)}
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  {columns.map((f) => (
                    <td key={f.key} className={f.key === entity.titleField ? "whitespace-nowrap px-4 py-2.5 font-medium" : "whitespace-nowrap px-4 py-2.5"}>
                      <CellValue field={f} value={r[f.key]} currency={blueprint.currency} />
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-1.5 text-right">
                    {rowActions.map((a) => <ActionButton key={a.id} action={a} row={r} />)}
                    <Button size="sm" variant="ghost" onClick={() => open(r)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="danger" onClick={() => remove(r)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={columns.length + 1} className="px-4 py-10 text-center text-muted-foreground">No {entity.plural.toLowerCase()} found.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={`${editing?.row ? "Edit" : "New"} ${entity.label.toLowerCase()}`}>
        {editing && (
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {entity.fields.map((f) => (
                <div key={f.key} className={f.type === "longtext" ? "sm:col-span-2" : undefined}>
                  <Label>{f.label}</Label>
                  <FieldInput field={f} value={editing.draft[f.key]} onChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, [f.key]: v } })} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" variant="primary">Save</Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
