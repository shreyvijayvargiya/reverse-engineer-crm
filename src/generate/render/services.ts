import { CATEGORIES, type ToolDef } from "../../catalog/tools.js";
import { camel, marker } from "./names.js";

export function renderService(tool: ToolDef): string {
  const cat = CATEGORIES[tool.category];
  const varName = camel(tool.id);
  return `${marker.ts}import { invoke } from "./_runtime";
import { mocks } from "./mocks";
import type { ${cat.input}, ${cat.output} } from "./types";

/**
 * ${tool.name}
 * Category: ${tool.category} · Auth: ${tool.auth} · Docs: ${tool.docsUrl}
 *
 * Mock mode (no VITE_API_BASE_URL): returns demo data.
 * Live mode: POSTs to \`\${VITE_API_BASE_URL}/${tool.id}/${cat.method}\`. Implement that route on your backend:
 *   Vendor call:   ${tool.http}
 *   Backend env:   ${tool.envVars.join(", ")}   (server-side only, never VITE_-prefixed)${tool.note ? `\n *   Note:          ${tool.note}` : ""}
 * Verify the endpoint against the docs above; vendors version their APIs.
 */
export const ${varName} = {
  id: "${tool.id}",
  name: ${JSON.stringify(tool.name)},
  category: "${tool.category}" as const,
  docsUrl: "${tool.docsUrl}",
  ${cat.method}: (input: ${cat.input}) =>
    invoke<${cat.input}, ${cat.output}>("${tool.id}", "${cat.method}", input, mocks.${tool.category}),
};
`;
}

export function renderServicesIndex(tools: ToolDef[], primary: Record<string, string>): string {
  const imports = tools.map((t) => `import { ${camel(t.id)} } from "./${t.id}";`).join("\n");
  const entries = Object.entries(primary)
    .map(([cat, id]) => `  ${cat}: ${camel(id)},`)
    .join("\n");
  const all = tools.map((t) => camel(t.id)).join(", ");
  return `${marker.ts}${imports}${imports ? "\n" : ""}
export interface ServiceInfo {
  id: string;
  name: string;
  category: string;
  docsUrl: string;
}

/** One tool per category is wired into the UI. Change which one in blueprint.json (primaryTools). */
export const services = {
${entries}
};

export const allTools: ServiceInfo[] = [${all}];
`;
}
