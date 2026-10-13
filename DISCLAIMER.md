# Disclaimer and responsible use

Reverse Engineer CRM turns a description of **your own workflow**, and optionally exports from **your own tools**, into a frontend codebase. It is not a tool for copying other companies' software.

## What it is for
- Rebuilding a workflow you run today (spreadsheets, an old CRM export, a tool you own or are licensed to export from) as a codebase you control.
- Prototyping a CRM or dashboard for a client, with typed stubs for the integrations they will need.

## What it will not do, and what you must not use it for
- It does not read, decompile or copy proprietary application code, UI assets or protected content. The analyzers read only column names and types from a CSV you provide and endpoint paths and JSON key names from a HAR you captured yourself.
- Do not feed it traffic or data from systems you are not authorised to inspect, and do not use it to clone a competitor's product, bypass licensing, or circumvent access controls.
- HAR files can contain cookies and tokens. `rcrm` never reads request/response headers, cookies, query values or body values into its output, but you should still treat HAR files as secrets and delete them when done.

## Generated apps
- Messaging (WhatsApp, SMS, email): only message people who opted in, and follow each provider's policies and the laws that apply to you (for example WhatsApp template rules, SMS registration rules such as DLT in India, CAN-SPAM, GDPR/ePrivacy). Generated send actions are gated on a `marketingOptIn` field, but compliance is your responsibility.
- Scraping: only collect data you are permitted to collect. Respect each site's terms of service and robots.txt.
- Payments and personal data: generated apps store demo data in browser localStorage and call vendors only through stubs. Before going live, add authentication, authorisation, server-side validation and a real database. Vendor secrets must live on a server.
- Vendor endpoints shown in stubs and docs are scaffolding hints taken from public documentation at authoring time. Vendors change their APIs; verify against the linked docs.

## Planning with Claude
With the Claude planner, your description and the structure of any `--from` files are sent to the Anthropic API. Use `--offline` to keep everything local.

## Warranty
Provided "as is" under the MIT license, without warranty of any kind. Generated code has not been security audited. Review it before using it with real customer data.
