import type { Blueprint, Entity, Field } from "../../blueprint/schema.js";
import { getTool } from "../../catalog/tools.js";
import { kebab, marker, pascal, snake } from "./names.js";

export function renderRoutes(bp: Blueprint): string {
  const imports = bp.modules.map((m) => `import ${pascal(m.id)}Page from "./pages/modules/${kebab(m.id)}";`).join("\n");
  const routes = bp.modules.map((m) => `        <Route path="/${kebab(m.id)}" element={<${pascal(m.id)}Page />} />`).join("\n");
  return `${marker.ts}import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";
${imports}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
${routes}
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
`;
}

export function renderModulePage(moduleId: string): string {
  return `${marker.ts}import { blueprint } from "../../generated/blueprint";
import { ModulePage } from "../ModulePage";

const mod = blueprint.modules.find((m) => m.id === "${moduleId}")!;

export default function ${pascal(moduleId)}Page() {
  return <ModulePage module={mod} />;
}
`;
}

/** The runtime only needs these fields; seedCount/samples are generator-only. */
function runtimeBlueprint(bp: Blueprint) {
  return {
    ...bp,
    stack: undefined,
    modules: bp.modules.map((m) => ({
      ...m,
      entities: m.entities.map((e: Entity) => ({
        ...e,
        seedCount: undefined,
        fields: e.fields.map((f: Field) => ({ ...f, samples: undefined })),
      })),
    })),
  };
}

export function renderBlueprintTs(bp: Blueprint): string {
  return `${marker.ts}import type { Blueprint } from "../lib/types";

export const blueprint = ${JSON.stringify(runtimeBlueprint(bp), null, 2)} as unknown as Blueprint;
`;
}

export function renderSeedTs(seed: unknown): string {
  return `${marker.ts}import type { Row } from "../lib/types";

export const seed = ${JSON.stringify(seed, null, 2)} as unknown as Record<string, Row[]>;
`;
}

export function renderPackageJson(bp: Blueprint): string {
  return (
    JSON.stringify(
      {
        name: bp.slug,
        private: true,
        version: "0.1.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "tsc --noEmit && vite build",
          preview: "vite preview",
          typecheck: "tsc --noEmit",
        },
        dependencies: {
          "lucide-react": "^0.468.0",
          react: "^18.3.1",
          "react-dom": "^18.3.1",
          "react-router-dom": "^6.28.0",
        },
        devDependencies: {
          "@types/react": "^18.3.12",
          "@types/react-dom": "^18.3.1",
          "@vitejs/plugin-react": "^4.3.4",
          autoprefixer: "^10.4.20",
          postcss: "^8.4.49",
          tailwindcss: "^3.4.17",
          typescript: "~5.6.2",
          vite: "^6.0.1",
        },
      },
      null,
      2,
    ) + "\n"
  );
}

export function renderEnvExample(bp: Blueprint): string {
  const tools = bp.tools.map((id) => getTool(id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  const server = tools
    .map((t) => `# ${t.name}\n${t.envVars.map((v) => `# ${v}=`).join("\n")}`)
    .join("\n");
  return `${marker.hash}# Frontend (Vite). Leave empty to run on mock data.
VITE_API_BASE_URL=

# Backend only. These belong in YOUR server's environment, never in a VITE_ variable:
${server || "# (none)"}
`;
}

const SQL_TYPES: Record<string, string> = {
  number: "numeric",
  currency: "numeric(12,2)",
  boolean: "boolean",
  date: "date",
  datetime: "timestamp",
  rating: "smallint",
};

export function renderSupabaseSchema(bp: Blueprint): string {
  const tables = bp.modules
    .flatMap((m) => m.entities)
    .map((e) => {
      const cols = e.fields
        .map((f) => `  ${snake(f.key)} ${SQL_TYPES[f.type] ?? "text"}`)
        .join(",\n");
      const table = snake(e.key);
      return `create table if not exists public.${table} (
  id text primary key default gen_random_uuid()::text,
${cols},
  created_at timestamptz not null default now()
);
-- Row level security is ON with no policies: nothing is readable until you add policies for your auth model.
alter table public.${table} enable row level security;
`;
    })
    .join("\n");
  return `${marker.sql}-- Generated from blueprint.json. Column names are snake_case versions of field keys.
${tables}`;
}
