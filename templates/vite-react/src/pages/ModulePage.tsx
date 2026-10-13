import { useState } from "react";
import { EntityView } from "../components/EntityView";
import { cn } from "../lib/utils";
import type { Module } from "../lib/types";

export function ModulePage({ module }: { module: Module }) {
  const [tab, setTab] = useState(module.entities[0].key);
  const entity = module.entities.find((e) => e.key === tab) ?? module.entities[0];
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{module.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
      </div>
      {module.entities.length > 1 && (
        <div className="flex gap-1 border-b border-border">
          {module.entities.map((e) => (
            <button
              key={e.key}
              onClick={() => setTab(e.key)}
              className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", e.key === entity.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {e.plural}
            </button>
          ))}
        </div>
      )}
      <EntityView key={entity.key} entity={entity} />
    </div>
  );
}
