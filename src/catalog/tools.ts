/**
 * Third-party tool registry.
 *
 * Tools are grouped into CATEGORIES. A category has one canonical method signature, so the generated UI
 * never changes when you swap Twilio for Vonage or SendGrid for Resend: only the service stub does.
 *
 * `http` is a scaffolding hint taken from each vendor's public docs at authoring time. Vendors version their
 * APIs; always confirm against `docsUrl` before wiring the real call.
 */

export type ToolCategoryId =
  | "whatsapp"
  | "sms"
  | "email"
  | "payments"
  | "scraping"
  | "notify"
  | "calendar"
  | "forms"
  | "crm"
  | "sheets";

export interface CategoryDef {
  id: ToolCategoryId;
  label: string;
  method: string;
  summary: string;
  /** TypeScript type names (defined in templates/vite-react/src/services/types.ts). */
  input: string;
  output: string;
  /** OpenAPI-ish property lists used for openapi.yaml. */
  inputProps: Record<string, string>;
  outputProps: Record<string, string>;
}

export const CATEGORIES: Record<ToolCategoryId, CategoryDef> = {
  whatsapp: {
    id: "whatsapp",
    label: "WhatsApp messaging",
    method: "sendBroadcast",
    summary: "Send a message to many recipients (opted-in contacts only).",
    input: "BroadcastInput",
    output: "BroadcastResult",
    inputProps: { recipients: "string[]", message: "string", template: "string?" },
    outputProps: { accepted: "number", failed: "number" },
  },
  sms: {
    id: "sms",
    label: "SMS",
    method: "sendBroadcast",
    summary: "Send an SMS to many recipients (opted-in contacts only).",
    input: "BroadcastInput",
    output: "BroadcastResult",
    inputProps: { recipients: "string[]", message: "string" },
    outputProps: { accepted: "number", failed: "number" },
  },
  email: {
    id: "email",
    label: "Email sending",
    method: "sendCampaign",
    summary: "Send an email to many recipients (opted-in contacts only).",
    input: "CampaignInput",
    output: "BroadcastResult",
    inputProps: { recipients: "string[]", subject: "string", body: "string" },
    outputProps: { accepted: "number", failed: "number" },
  },
  payments: {
    id: "payments",
    label: "Payments",
    method: "createPaymentLink",
    summary: "Create a hosted payment link for an invoice.",
    input: "PaymentLinkInput",
    output: "PaymentLinkResult",
    inputProps: { reference: "string", amount: "number", currency: "string", customerEmail: "string?" },
    outputProps: { id: "string", url: "string" },
  },
  scraping: {
    id: "scraping",
    label: "Web scraping",
    method: "runScrape",
    summary: "Run a scrape of a public page and return structured records.",
    input: "ScrapeInput",
    output: "ScrapeResult",
    inputProps: { url: "string", selector: "string?" },
    outputProps: { runId: "string", records: "ScrapedRecord[]" },
  },
  notify: {
    id: "notify",
    label: "Team notifications",
    method: "postMessage",
    summary: "Post a message to a team chat channel.",
    input: "NotifyInput",
    output: "NotifyResult",
    inputProps: { text: "string" },
    outputProps: { ok: "boolean" },
  },
  calendar: {
    id: "calendar",
    label: "Calendar",
    method: "createEvent",
    summary: "Create a calendar event.",
    input: "EventInput",
    output: "EventResult",
    inputProps: { title: "string", start: "string", durationMin: "number", attendeeEmail: "string?" },
    outputProps: { eventId: "string" },
  },
  forms: {
    id: "forms",
    label: "Forms and surveys",
    method: "importResponses",
    summary: "Fetch recent form or survey responses.",
    input: "ImportInput",
    output: "ImportResult",
    inputProps: { formId: "string?" },
    outputProps: { rows: "Record<string, unknown>[]" },
  },
  crm: {
    id: "crm",
    label: "External CRM sync",
    method: "pushContact",
    summary: "Create or update a contact in an external CRM.",
    input: "PushContactInput",
    output: "PushContactResult",
    inputProps: { name: "string", email: "string?", phone: "string?", company: "string?" },
    outputProps: { externalId: "string" },
  },
  sheets: {
    id: "sheets",
    label: "Spreadsheet / database export",
    method: "exportRows",
    summary: "Append rows to a spreadsheet or table.",
    input: "ExportInput",
    output: "ExportResult",
    inputProps: { entity: "string", rows: "Record<string, unknown>[]" },
    outputProps: { updated: "number" },
  },
};

export type ToolAuth = "bearer" | "basic" | "api-key" | "oauth" | "webhook";

export interface ToolDef {
  id: string;
  name: string;
  category: ToolCategoryId;
  auth: ToolAuth;
  envVars: string[];
  docsUrl: string;
  /** Scaffolding hint: the vendor call your backend route should make. */
  http: string;
  note?: string;
  /** Used by the offline planner. */
  keywords: string[];
}

export const TOOLS: ToolDef[] = [
  // WhatsApp
  {
    id: "whatsapp-cloud",
    name: "WhatsApp Cloud API (Meta)",
    category: "whatsapp",
    auth: "bearer",
    envVars: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    http: "POST https://graph.facebook.com/{version}/{WHATSAPP_PHONE_NUMBER_ID}/messages",
    note: "Marketing messages outside the 24h window must use approved templates. Only message contacts who opted in.",
    keywords: ["whatsapp", "wa", "broadcast"],
  },
  {
    id: "twilio-whatsapp",
    name: "Twilio (WhatsApp)",
    category: "whatsapp",
    auth: "basic",
    envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM"],
    docsUrl: "https://www.twilio.com/docs/whatsapp",
    http: "POST https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json",
    keywords: ["twilio whatsapp"],
  },
  // SMS
  {
    id: "twilio-sms",
    name: "Twilio SMS",
    category: "sms",
    auth: "basic",
    envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"],
    docsUrl: "https://www.twilio.com/docs/sms",
    http: "POST https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json",
    keywords: ["sms", "text message", "twilio"],
  },
  {
    id: "vonage-sms",
    name: "Vonage SMS",
    category: "sms",
    auth: "api-key",
    envVars: ["VONAGE_API_KEY", "VONAGE_API_SECRET", "VONAGE_FROM"],
    docsUrl: "https://developer.vonage.com/en/messaging/sms/overview",
    http: "POST https://rest.nexmo.com/sms/json",
    keywords: ["vonage", "nexmo"],
  },
  {
    id: "msg91",
    name: "MSG91",
    category: "sms",
    auth: "api-key",
    envVars: ["MSG91_AUTH_KEY", "MSG91_TEMPLATE_ID"],
    docsUrl: "https://docs.msg91.com/",
    http: "POST https://api.msg91.com/api/v5/flow/",
    note: "India: DLT-registered templates are required for transactional/promotional SMS.",
    keywords: ["msg91", "india sms"],
  },
  // Email
  {
    id: "sendgrid",
    name: "SendGrid",
    category: "email",
    auth: "bearer",
    envVars: ["SENDGRID_API_KEY", "EMAIL_FROM"],
    docsUrl: "https://docs.sendgrid.com/api-reference/mail-send/mail-send",
    http: "POST https://api.sendgrid.com/v3/mail/send",
    keywords: ["sendgrid", "email", "newsletter"],
  },
  {
    id: "resend",
    name: "Resend",
    category: "email",
    auth: "bearer",
    envVars: ["RESEND_API_KEY", "EMAIL_FROM"],
    docsUrl: "https://resend.com/docs/api-reference/emails/send-email",
    http: "POST https://api.resend.com/emails",
    keywords: ["resend", "email", "transactional"],
  },
  {
    id: "mailgun",
    name: "Mailgun",
    category: "email",
    auth: "basic",
    envVars: ["MAILGUN_API_KEY", "MAILGUN_DOMAIN", "EMAIL_FROM"],
    docsUrl: "https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages",
    http: "POST https://api.mailgun.net/v3/{MAILGUN_DOMAIN}/messages",
    keywords: ["mailgun"],
  },
  {
    id: "postmark",
    name: "Postmark",
    category: "email",
    auth: "api-key",
    envVars: ["POSTMARK_SERVER_TOKEN", "EMAIL_FROM"],
    docsUrl: "https://postmarkapp.com/developer/api/email-api",
    http: "POST https://api.postmarkapp.com/email",
    keywords: ["postmark"],
  },
  // Payments
  {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    auth: "bearer",
    envVars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    docsUrl: "https://docs.stripe.com/api/payment-link/create",
    http: "POST https://api.stripe.com/v1/payment_links",
    note: "Never call with the secret key from the browser; route through your backend. Handle payment webhooks to mark invoices Paid.",
    keywords: ["stripe", "payment", "invoice", "card"],
  },
  {
    id: "razorpay",
    name: "Razorpay",
    category: "payments",
    auth: "basic",
    envVars: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
    docsUrl: "https://razorpay.com/docs/api/payments/payment-links/",
    http: "POST https://api.razorpay.com/v1/payment_links",
    keywords: ["razorpay", "upi", "india payment"],
  },
  // Scraping
  {
    id: "apify",
    name: "Apify",
    category: "scraping",
    auth: "bearer",
    envVars: ["APIFY_TOKEN", "APIFY_ACTOR_ID"],
    docsUrl: "https://docs.apify.com/api/v2",
    http: "POST https://api.apify.com/v2/acts/{APIFY_ACTOR_ID}/runs",
    note: "Respect each target site's terms of service and robots.txt.",
    keywords: ["apify", "scrape", "scraper", "crawl"],
  },
  {
    id: "firecrawl",
    name: "Firecrawl",
    category: "scraping",
    auth: "bearer",
    envVars: ["FIRECRAWL_API_KEY"],
    docsUrl: "https://docs.firecrawl.dev/",
    http: "POST https://api.firecrawl.dev/v1/scrape",
    keywords: ["firecrawl", "scrape", "crawl"],
  },
  {
    id: "scrapingbee",
    name: "ScrapingBee",
    category: "scraping",
    auth: "api-key",
    envVars: ["SCRAPINGBEE_API_KEY"],
    docsUrl: "https://www.scrapingbee.com/documentation/",
    http: "GET https://app.scrapingbee.com/api/v1/?api_key={SCRAPINGBEE_API_KEY}&url={url}",
    keywords: ["scrapingbee", "scrape"],
  },
  // Notifications
  {
    id: "slack",
    name: "Slack",
    category: "notify",
    auth: "bearer",
    envVars: ["SLACK_BOT_TOKEN", "SLACK_CHANNEL_ID"],
    docsUrl: "https://api.slack.com/methods/chat.postMessage",
    http: "POST https://slack.com/api/chat.postMessage",
    keywords: ["slack", "notify", "alert"],
  },
  {
    id: "discord-webhook",
    name: "Discord webhook",
    category: "notify",
    auth: "webhook",
    envVars: ["DISCORD_WEBHOOK_URL"],
    docsUrl: "https://discord.com/developers/docs/resources/webhook#execute-webhook",
    http: "POST {DISCORD_WEBHOOK_URL}",
    keywords: ["discord"],
  },
  // Calendar
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "calendar",
    auth: "oauth",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALENDAR_ID"],
    docsUrl: "https://developers.google.com/calendar/api/v3/reference/events/insert",
    http: "POST https://www.googleapis.com/calendar/v3/calendars/{GOOGLE_CALENDAR_ID}/events",
    keywords: ["google calendar", "calendar", "appointment", "booking"],
  },
  {
    id: "cal-com",
    name: "Cal.com",
    category: "calendar",
    auth: "bearer",
    envVars: ["CAL_API_KEY"],
    docsUrl: "https://cal.com/docs/api-reference/v2/introduction",
    http: "POST https://api.cal.com/v2/bookings",
    note: "Requires a cal-api-version header; check the docs for the current value.",
    keywords: ["cal.com", "booking", "scheduling"],
  },
  // Forms
  {
    id: "typeform",
    name: "Typeform",
    category: "forms",
    auth: "bearer",
    envVars: ["TYPEFORM_TOKEN", "TYPEFORM_FORM_ID"],
    docsUrl: "https://www.typeform.com/developers/responses/",
    http: "GET https://api.typeform.com/forms/{TYPEFORM_FORM_ID}/responses",
    keywords: ["typeform", "survey", "feedback form"],
  },
  {
    id: "tally",
    name: "Tally",
    category: "forms",
    auth: "bearer",
    envVars: ["TALLY_API_KEY", "TALLY_FORM_ID"],
    docsUrl: "https://developers.tally.so/",
    http: "GET https://api.tally.so/forms/{TALLY_FORM_ID}/submissions",
    keywords: ["tally", "form"],
  },
  // External CRM
  {
    id: "hubspot",
    name: "HubSpot",
    category: "crm",
    auth: "bearer",
    envVars: ["HUBSPOT_ACCESS_TOKEN"],
    docsUrl: "https://developers.hubspot.com/docs/api/crm/contacts",
    http: "POST https://api.hubapi.com/crm/v3/objects/contacts",
    keywords: ["hubspot"],
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    category: "crm",
    auth: "api-key",
    envVars: ["PIPEDRIVE_API_TOKEN"],
    docsUrl: "https://developers.pipedrive.com/docs/api/v1/Persons",
    http: "POST https://api.pipedrive.com/v1/persons",
    keywords: ["pipedrive"],
  },
  // Sheets / databases
  {
    id: "google-sheets",
    name: "Google Sheets",
    category: "sheets",
    auth: "oauth",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_SHEET_ID"],
    docsUrl: "https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/append",
    http: "POST https://sheets.googleapis.com/v4/spreadsheets/{GOOGLE_SHEET_ID}/values/{range}:append",
    keywords: ["google sheets", "spreadsheet", "sheet", "excel"],
  },
  {
    id: "airtable",
    name: "Airtable",
    category: "sheets",
    auth: "bearer",
    envVars: ["AIRTABLE_TOKEN", "AIRTABLE_BASE_ID"],
    docsUrl: "https://airtable.com/developers/web/api/create-records",
    http: "POST https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/{table}",
    keywords: ["airtable"],
  },
  {
    id: "notion",
    name: "Notion",
    category: "sheets",
    auth: "bearer",
    envVars: ["NOTION_TOKEN", "NOTION_DATABASE_ID"],
    docsUrl: "https://developers.notion.com/reference/post-page",
    http: "POST https://api.notion.com/v1/pages",
    note: "Requires a Notion-Version header; check the docs for the current value.",
    keywords: ["notion"],
  },
];

export const TOOL_IDS = TOOLS.map((t) => t.id);

export function getTool(id: string): ToolDef | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function defaultToolFor(category: string): ToolDef | undefined {
  return TOOLS.find((t) => t.category === category);
}
