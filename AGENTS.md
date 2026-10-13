# AGENTS.md

Guidance for AI coding agents working on **this** repository (the generator). Generated CRMs get their own AGENTS.md.

## What this repo is
`rcrm` takes a plain-English description of a workflow and produces a frontend-only React CRM/dashboard repo. The model never writes React. The pipeline is:

```
description (+ CSV/HAR structure) -> planner -> Brief -> expandBrief -> Blueprint -> generate -> repo
                                  Claude | offline       (deterministic)            (deterministic)
```

- `src/blueprint/schema.ts`: full Blueprint (zod v3). `src/blueprint/brief.ts`: the small Brief the planner returns (zod **v4**, because the Anthropic SDK's `zodOutputFormat` needs v4).
- `src/catalog/modules.ts`: modules (entities, fields, kanban field, actions, stats). `src/catalog/tools.ts`: tool categories and the tool registry.
- `src/plan/expand.ts`: Brief -> Blueprint, cross-module rules, tool resolution, add/remove edits. `src/plan/offline.ts`: keyword planner.
- `src/agent/`: Claude planner (`claude.ts`, one structured-output call), prompt built from the live catalog (`prompt.ts`), propose-then-adjust interview (`interview.ts`).
- `src/analyze/`: CSV and HAR structure extraction. These must never put row values, headers, cookies, tokens or query values in their output (tests enforce this).
- `src/generate/`: renderers plus `templates/vite-react/` (static runtime copied once, then owned by the user).

## Commands
- `npm install`, `npm run typecheck`, `npm test`, `npm run build`
- `npm run test:e2e` generates an app with every module and tool, installs it, and builds it. Run it after touching `templates/` or `src/generate/`.
- `npm run dev -- generate "..." --offline --yes --out .tmp/x` to try the CLI without a model call.

## Invariants (do not break)
1. **The model plans, code generates.** Do not make the planner emit code or file contents.
2. **Planner output is validated.** Anything from Claude goes through `BriefSchema` and `expandBrief` (which sanitises keys and enforces the catalog). Never trust model-provided ids.
3. **Catalog changes keep tests green**: every module must expand alone, every action slot must map to a category with at least one tool.
4. **Generated files that are derived from the blueprint carry the `@rcrm-generated` marker**; static runtime files are written only if absent. `rcrm regenerate` must never overwrite a file the user edited (marker removed) or a static file.
5. **No secrets in generated browser code.** Vendor calls go through `src/services/_runtime.ts` to a backend URL. Do not add `VITE_`-prefixed secrets anywhere.
6. **Messaging actions stay opt-in gated** (`marketingOptIn`), and scraping/messaging docs keep their compliance notes.
7. Vendor endpoints in `tools.ts` are hints from public docs. When adding a tool, link the vendor docs page you used and mark API-version quirks in `note`.

## Adding things
- **Module**: add a `ModuleDef` in `modules.ts` (keywords for the offline planner, `requires`, actions with `core` only if the module is pointless without that tool), add its action handler in `templates/vite-react/src/lib/actions.ts`, run `npm test` and `npm run test:e2e`.
- **Tool**: add to `TOOLS` in `tools.ts` under an existing category. A new category also needs: `CATEGORIES` entry, input/output types in `templates/.../services/types.ts`, a mock in `services/mocks.ts`.
- **Stack** (Next.js, TanStack Start, other icon sets): add a new template directory and a renderer set. Keep the Blueprint stack-agnostic; only emitters differ. Icons are isolated in `components/Icon.tsx`.

## Conventions
TypeScript strict, ESM (`.js` import suffixes), no new runtime dependencies without a reason (the CLI currently needs only `@anthropic-ai/sdk` and `zod`).
