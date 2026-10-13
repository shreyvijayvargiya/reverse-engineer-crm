import { blueprint } from "../generated/blueprint";
import { computeStat, formatStat } from "../lib/stats";
import { useActivity, useRows } from "../lib/store";
import type { Entity, Module, Stat } from "../lib/types";
import { Badge, Card, toneFor } from "../components/ui";

function StatCard({ stat }: { stat: Stat }) {
  const rows = useRows(stat.entity);
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{stat.label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{formatStat(stat, computeStat(stat, rows), blueprint.currency)}</div>
    </Card>
  );
}

function Breakdown({ entity }: { entity: Entity }) {
  const rows = useRows(entity.key);
  const field = entity.fields.find((f) => f.key === entity.boardField);
  if (!field) return null;
  const options = field.options ?? [];
  const counts = options.map((o) => rows.filter((r) => r[field.key] === o).length);
  const max = Math.max(1, ...counts);
  return (
    <Card className="p-4">
      <div className="mb-3 text-sm font-medium">{entity.plural} by {field.label.toLowerCase()}</div>
      <div className="space-y-2">
        {options.map((o, i) => (
          <div key={o} className="flex items-center gap-3 text-sm">
            <div className="w-28 shrink-0"><Badge tone={toneFor(o, i)}>{o}</Badge></div>
            <div className="h-2 flex-1 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${(counts[i] / max) * 100}%` }} />
            </div>
            <div className="w-8 text-right tabular-nums text-muted-foreground">{counts[i]}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Dashboard() {
  const activity = useActivity();
  const stats = blueprint.modules.flatMap((m: Module) => m.stats).slice(0, 8);
  const boards = blueprint.modules.flatMap((m) => m.entities).filter((e) => e.boardField).slice(0, 2);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{blueprint.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{blueprint.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => <StatCard key={`${s.entity}-${s.label}-${i}`} stat={s} />)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {boards.map((e) => <Breakdown key={e.key} entity={e} />)}
        <Card className="p-4">
          <div className="mb-3 text-sm font-medium">Recent activity</div>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Actions you take (sending, creating, updating) show up here.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activity.slice(0, 8).map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span>{a.text}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
