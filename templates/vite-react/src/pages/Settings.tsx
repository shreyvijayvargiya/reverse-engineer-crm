import { ExternalLink } from "lucide-react";
import { blueprint } from "../generated/blueprint";
import { allTools } from "../services";
import { isLive } from "../services/_runtime";
import { store } from "../lib/store";
import { download } from "../lib/utils";
import { Badge, Button, Card, useToast } from "../components/ui";

export function Settings() {
  const toast = useToast();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Integrations and data for this workspace.</p>
      </div>

      <Card className="p-4">
        <div className="mb-1 text-sm font-medium">Integrations</div>
        <p className="mb-3 text-sm text-muted-foreground">
          {isLive
            ? "Live mode: service stubs call your backend at VITE_API_BASE_URL."
            : "Mock mode: no backend is configured, so every integration returns demo data. Set VITE_API_BASE_URL to go live (see INTEGRATIONS.md)."}
        </p>
        {allTools.length === 0 ? (
          <p className="text-sm text-muted-foreground">No third-party tools are used by this CRM.</p>
        ) : (
          <div className="divide-y divide-border">
            {allTools.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <div className="min-w-[180px] flex-1 font-medium">{t.name}</div>
                <Badge>{t.category}</Badge>
                {blueprint.primaryTools[t.category] === t.id ? <Badge tone="green">In use</Badge> : <Badge tone="gray">Stub only</Badge>}
                <Badge tone={isLive ? "green" : "amber"}>{isLive ? "Live" : "Mock"}</Badge>
                <a className="inline-flex items-center gap-1 text-primary hover:underline" href={t.docsUrl} target="_blank" rel="noreferrer">
                  Docs <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="mb-1 text-sm font-medium">Data</div>
        <p className="mb-3 text-sm text-muted-foreground">
          Data layer: <strong>{blueprint.dataLayer}</strong>. Records are kept in your browser (localStorage) until you connect a backend.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => download(`${blueprint.slug}-data.json`, store.exportAll(), "application/json")}>Export all data (JSON)</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm("Reset all records to the demo data?")) {
                store.reset();
                toast("Demo data restored");
              }
            }}
          >
            Reset demo data
          </Button>
        </div>
      </Card>
    </div>
  );
}
