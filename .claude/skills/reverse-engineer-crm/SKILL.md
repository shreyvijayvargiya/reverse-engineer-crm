---
name: reverse-engineer-crm
description: Turn a description of someone's workflow (clinic, agency, store, scraping, WhatsApp/email outreach, feedback, invoicing...) into a frontend CRM or dashboard codebase with integration stubs, using the rcrm CLI. Use when the user asks to build, scaffold or prototype a CRM, dashboard, pipeline, campaign manager, scraper dashboard or tracker, or to "reverse engineer" their workflow into software.
---

# Reverse Engineer CRM

You act as the planner. The `rcrm` CLI does the deterministic generation, so you never hand-write React for the CRM.

## Steps

1. **Understand the workflow.** Ask at most 3 short questions only if the request is too vague to choose modules ("I need a CRM"). Otherwise proceed.
2. **See the catalog.** Run `rcrm modules` and `rcrm tools`. Use only those ids.
3. **If the user gave their own exports** (CSV from their current tool, or a HAR from their own session), run `rcrm analyze <file>` to see the structure. Never open a HAR yourself or print its headers, cookies, or bodies. Only use files the user owns or may inspect.
4. **Generate a first plan.**
   - With an Anthropic key available: `rcrm generate "<what they do>" --yes --out <dir>`
   - Without one: `rcrm generate "<what they do>" --offline --yes --out <dir>`, then tune with step 5.
5. **Tune to the workflow** with `rcrm add <id...>` / `rcrm remove <id...>` run inside the output directory (modules and tools share one syntax). Pick the smallest set of modules that covers the workflow; name vendors the user mentioned (`stripe`, `whatsapp-cloud`, `resend`, `slack`...). To rename modules into the user's vocabulary (Contacts -> Patients) or add fields, edit `blueprint.json` and run `rcrm regenerate`.
6. **Verify.** In the output directory: `npm install && npm run build`. Report real output.
7. **Hand over.** Tell the user what is real (UI, localStorage data) and what is mocked (every integration), point them to `INTEGRATIONS.md`, `openapi.yaml` and `AGENTS.md`, and give the `npm run dev` command.

## Rules
- Messaging modules (WhatsApp, SMS, email) must stay gated on contact opt-in. Mention consent and provider policy rules to the user.
- Scraping: remind the user to respect each site's terms and robots.txt.
- Never put vendor secrets in frontend code or `VITE_` variables.
- Do not claim an integration works against the real vendor: they are stubs until the user builds the backend routes.
- Do not clone or copy another company's proprietary product. This tool rebuilds the user's own workflow.
