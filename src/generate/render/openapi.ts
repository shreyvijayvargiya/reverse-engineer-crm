import type { Blueprint } from "../../blueprint/schema.js";
import { CATEGORIES, getTool } from "../../catalog/tools.js";
import { marker } from "./names.js";

function schemaFor(type: string): { schema: string[]; optional: boolean } {
  const optional = type.endsWith("?");
  const t = optional ? type.slice(0, -1) : type;
  const ind = "            ";
  if (t === "string" || t === "number" || t === "boolean") return { schema: [`${ind}type: ${t}`], optional };
  if (t === "string[]") return { schema: [`${ind}type: array`, `${ind}items: { type: string }`], optional };
  if (t === "ScrapedRecord[]")
    return {
      schema: [
        `${ind}type: array`,
        `${ind}items:`,
        `${ind}  type: object`,
        `${ind}  properties:`,
        `${ind}    title: { type: string }`,
        `${ind}    url: { type: string }`,
        `${ind}    data: { type: object }`,
      ],
      optional,
    };
  return { schema: [`${ind}type: array`, `${ind}items: { type: object }`], optional };
}

function objectSchema(name: string, props: Record<string, string>): string {
  const required = Object.entries(props).filter(([, t]) => !t.endsWith("?")).map(([k]) => k);
  const lines = [`    ${name}:`, `      type: object`];
  if (required.length) lines.push(`      required: [${required.join(", ")}]`);
  lines.push(`      properties:`);
  for (const [k, t] of Object.entries(props)) {
    lines.push(`        ${k}:`);
    lines.push(...schemaFor(t).schema.map((l) => l.replace(/^ {4}/, "")));
  }
  return lines.join("\n");
}

export function renderOpenApi(bp: Blueprint): string {
  const tools = bp.tools.map((id) => getTool(id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  const cats = [...new Set(tools.map((t) => t.category))];
  const paths = tools
    .map((t) => {
      const c = CATEGORIES[t.category];
      return `  /${t.id}/${c.method}:
    post:
      summary: ${t.name} - ${c.summary}
      description: "Vendor call: ${t.http.replace(/"/g, "'")}. Docs: ${t.docsUrl}"
      operationId: ${t.id.replace(/-/g, "_")}_${c.method}
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/${c.input}' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/${c.output}' }`;
    })
    .join("\n");

  const schemas = new Map<string, string>();
  for (const cat of cats) {
    const c = CATEGORIES[cat];
    schemas.set(c.input, objectSchema(c.input, c.inputProps));
    schemas.set(c.output, objectSchema(c.output, c.outputProps));
  }

  return `${marker.hash}openapi: 3.0.3
info:
  title: ${bp.name} - backend contract
  version: 0.1.0
  description: |
    Routes the frontend calls when VITE_API_BASE_URL is set. Each route wraps one third-party vendor call.
    Keep vendor credentials on the server. Verify vendor endpoints against their docs.
servers:
  - url: http://localhost:8787
    description: Set VITE_API_BASE_URL to this value in .env.local
paths:
${paths || "  {}"}
components:
  schemas:
${[...schemas.values()].join("\n") || "    {}"}
`;
}
