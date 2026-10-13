import type { Action, Entity, Field, Module } from "../blueprint/schema.js";

/**
 * Module catalog. Each module is a ready-made slice of a CRM: entities, columns, kanban field,
 * row/table actions and dashboard stats. The planner picks modules; the generator renders them.
 * Custom entities from the planner cover anything the catalog does not.
 */

export interface ModuleDef {
  module: Module;
  /** Module ids that must also be present (auto-added). */
  requires: string[];
  /** Offline planner keywords. */
  keywords: string[];
  /** One line the planner prompt shows to the model. */
  pitch: string;
}

const f = (
  key: string,
  label: string,
  type: Field["type"],
  extra: Partial<Field> = {},
): Field => ({ key, label, type, ...extra });

const row = (id: string, label: string, slots: string[] = [], core = false): Action => ({
  id,
  label,
  slots,
  scope: "row",
  ...(core ? { core: true } : {}),
});

const STATUS_AUDIENCE = ["All contacts", "New", "Contacted", "Qualified", "Customer"];

/* ---------------- contacts ---------------- */
const contacts: ModuleDef = {
  pitch: "People you sell to or serve: leads, patients, clients, members.",
  requires: [],
  keywords: ["lead", "leads", "contact", "contacts", "client", "clients", "customer", "customers", "patient", "patients", "member", "members", "crm", "prospect"],
  module: {
    id: "contacts",
    label: "Contacts",
    description: "Everyone you sell to or serve, with status and source.",
    icon: "users",
    entities: [
      {
        key: "contacts",
        label: "Contact",
        plural: "Contacts",
        icon: "users",
        titleField: "name",
        boardField: "status",
        seedCount: 14,
        fields: [
          f("name", "Name", "text"),
          f("email", "Email", "email"),
          f("phone", "Phone", "phone"),
          f("company", "Company", "text"),
          f("source", "Source", "select", { options: ["Website", "Referral", "WhatsApp", "Email", "Ads", "Walk-in"] }),
          f("status", "Status", "status", { options: ["New", "Contacted", "Qualified", "Customer", "Lost"] }),
          f("notes", "Notes", "longtext", { hidden: true }),
          f("createdAt", "Created", "date", { default: "today" }),
        ],
        actions: [row("contact.pushToCrm", "Sync to CRM", ["crm"])],
      },
    ],
    stats: [
      { label: "Contacts", entity: "contacts", agg: "count", format: "number" },
      { label: "New this stage", entity: "contacts", agg: "count", where: { field: "status", in: ["New"] }, format: "number" },
      { label: "Customers", entity: "contacts", agg: "count", where: { field: "status", in: ["Customer"] }, format: "number" },
    ],
  },
};

/* ---------------- deals ---------------- */
const deals: ModuleDef = {
  pitch: "Sales pipeline with stages and values (kanban).",
  requires: ["contacts"],
  keywords: ["deal", "deals", "pipeline", "sales", "opportunity", "opportunities", "proposal", "quote"],
  module: {
    id: "deals",
    label: "Deals",
    description: "Pipeline of opportunities by stage.",
    icon: "handshake",
    entities: [
      {
        key: "deals",
        label: "Deal",
        plural: "Deals",
        icon: "handshake",
        titleField: "title",
        boardField: "stage",
        seedCount: 12,
        fields: [
          f("title", "Deal", "text", { samples: ["Website redesign", "Annual plan", "Onboarding package", "Retainer", "Pilot project", "Enterprise license"] }),
          f("contact", "Contact", "text"),
          f("value", "Value", "currency"),
          f("stage", "Stage", "status", { options: ["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"] }),
          f("closeDate", "Close date", "date"),
          f("probability", "Probability %", "number"),
          f("owner", "Owner", "text"),
        ],
        actions: [],
      },
    ],
    stats: [
      { label: "Open pipeline", entity: "deals", agg: "sum", field: "value", where: { field: "stage", notIn: ["Won", "Lost"] }, format: "currency" },
      { label: "Won revenue", entity: "deals", agg: "sum", field: "value", where: { field: "stage", in: ["Won"] }, format: "currency" },
      { label: "Open deals", entity: "deals", agg: "count", where: { field: "stage", notIn: ["Won", "Lost"] }, format: "number" },
    ],
  },
};

/* ---------------- tasks ---------------- */
const tasks: ModuleDef = {
  pitch: "To-dos and follow-ups with owners and due dates.",
  requires: [],
  keywords: ["task", "tasks", "todo", "to-do", "follow up", "follow-up"],
  module: {
    id: "tasks",
    label: "Tasks",
    description: "Follow-ups and to-dos.",
    icon: "check-square",
    entities: [
      {
        key: "tasks",
        label: "Task",
        plural: "Tasks",
        icon: "check-square",
        titleField: "title",
        boardField: "status",
        seedCount: 10,
        fields: [
          f("title", "Task", "text", { samples: ["Call back", "Send proposal", "Update records", "Review contract", "Schedule demo", "Chase payment"] }),
          f("due", "Due", "date"),
          f("priority", "Priority", "select", { options: ["Low", "Medium", "High"] }),
          f("status", "Status", "status", { options: ["To do", "In progress", "Done"] }),
          f("assignee", "Assignee", "text"),
          f("related", "Related to", "text"),
        ],
        actions: [],
      },
    ],
    stats: [
      { label: "Open tasks", entity: "tasks", agg: "count", where: { field: "status", notIn: ["Done"] }, format: "number" },
      { label: "High priority", entity: "tasks", agg: "count", where: { field: "priority", in: ["High"] }, format: "number" },
    ],
  },
};

/* ---------------- invoices ---------------- */
const invoices: ModuleDef = {
  pitch: "Invoices with status, due dates and payment links.",
  requires: [],
  keywords: ["invoice", "invoices", "invoicing", "billing", "bill", "payment", "payments", "receipt"],
  module: {
    id: "invoices",
    label: "Invoices",
    description: "Create, send and track invoices.",
    icon: "file-text",
    entities: [
      {
        key: "invoices",
        label: "Invoice",
        plural: "Invoices",
        icon: "file-text",
        titleField: "number",
        boardField: "status",
        seedCount: 12,
        fields: [
          f("number", "Number", "text"),
          f("client", "Client", "text"),
          f("email", "Client email", "email"),
          f("amount", "Amount", "currency"),
          f("issueDate", "Issued", "date", { default: "today" }),
          f("dueDate", "Due", "date"),
          f("status", "Status", "status", { options: ["Draft", "Sent", "Paid", "Overdue"] }),
          f("paymentLink", "Payment link", "url", { hidden: true }),
          f("notes", "Notes", "longtext", { hidden: true }),
        ],
        actions: [
          row("invoice.paymentLink", "Create payment link", ["payments"]),
          row("invoice.markPaid", "Mark paid"),
        ],
      },
    ],
    stats: [
      { label: "Outstanding", entity: "invoices", agg: "sum", field: "amount", where: { field: "status", in: ["Sent", "Overdue"] }, format: "currency" },
      { label: "Paid", entity: "invoices", agg: "sum", field: "amount", where: { field: "status", in: ["Paid"] }, format: "currency" },
      { label: "Overdue invoices", entity: "invoices", agg: "count", where: { field: "status", in: ["Overdue"] }, format: "number" },
    ],
  },
};

/* ---------------- email campaigns ---------------- */
const emailCampaigns: ModuleDef = {
  pitch: "Email campaigns to a segment of contacts, with send results.",
  requires: ["contacts"],
  keywords: ["email", "emails", "newsletter", "campaign", "campaigns", "mailing", "drip", "outreach", "cold email"],
  module: {
    id: "email_campaigns",
    label: "Email campaigns",
    description: "Compose and send email campaigns to a contact segment.",
    icon: "mail",
    entities: [
      {
        key: "emailCampaigns",
        label: "Email campaign",
        plural: "Email campaigns",
        icon: "mail",
        titleField: "name",
        boardField: "status",
        seedCount: 8,
        fields: [
          f("name", "Campaign", "text", { samples: ["Spring offer", "Product update", "Re-engagement", "Welcome series", "Holiday notice"] }),
          f("subject", "Subject", "text"),
          f("audience", "Audience", "select", { options: STATUS_AUDIENCE }),
          f("body", "Body", "longtext", { hidden: true }),
          f("status", "Status", "status", { options: ["Draft", "Scheduled", "Sent"] }),
          f("scheduledFor", "Scheduled for", "datetime"),
          f("sent", "Sent", "number", { default: "0" }),
          f("failed", "Failed", "number", { default: "0" }),
          f("opened", "Opened", "number", { default: "0" }),
          f("clicked", "Clicked", "number", { default: "0" }),
        ],
        actions: [row("campaign.sendEmail", "Send now", ["email"], true)],
      },
    ],
    stats: [
      { label: "Campaigns sent", entity: "emailCampaigns", agg: "count", where: { field: "status", in: ["Sent"] }, format: "number" },
      { label: "Emails sent", entity: "emailCampaigns", agg: "sum", field: "sent", format: "number" },
    ],
  },
};

/* ---------------- whatsapp bulk ---------------- */
const whatsappBulk: ModuleDef = {
  pitch: "WhatsApp (or SMS) bulk messaging to opted-in contacts, with send results.",
  requires: ["contacts"],
  keywords: ["whatsapp", "bulk message", "bulk messaging", "broadcast", "sms", "text blast", "bulk sms"],
  module: {
    id: "whatsapp_bulk",
    label: "WhatsApp broadcasts",
    description: "Compose and send bulk messages to opted-in contacts.",
    icon: "message-circle",
    entities: [
      {
        key: "broadcasts",
        label: "Broadcast",
        plural: "Broadcasts",
        icon: "message-circle",
        titleField: "name",
        boardField: "status",
        seedCount: 8,
        fields: [
          f("name", "Broadcast", "text", { samples: ["Appointment reminder", "Weekend offer", "New arrivals", "Payment reminder", "Feedback request"] }),
          f("message", "Message", "longtext"),
          f("audience", "Audience", "select", { options: STATUS_AUDIENCE }),
          f("status", "Status", "status", { options: ["Draft", "Scheduled", "Sent", "Failed"] }),
          f("sent", "Sent", "number", { default: "0" }),
          f("failed", "Failed", "number", { default: "0" }),
          f("delivered", "Delivered", "number", { default: "0" }),
          f("read", "Read", "number", { default: "0" }),
          f("sentAt", "Sent at", "datetime"),
        ],
        actions: [row("broadcast.send", "Send now", ["whatsapp", "sms"], true)],
      },
    ],
    stats: [
      { label: "Broadcasts sent", entity: "broadcasts", agg: "count", where: { field: "status", in: ["Sent"] }, format: "number" },
      { label: "Messages sent", entity: "broadcasts", agg: "sum", field: "sent", format: "number" },
      { label: "Failed", entity: "broadcasts", agg: "sum", field: "failed", format: "number" },
    ],
  },
};

/* ---------------- feedback ---------------- */
const feedback: ModuleDef = {
  pitch: "Customer feedback and ratings, with sentiment and follow-up status.",
  requires: [],
  keywords: ["feedback", "review", "reviews", "rating", "ratings", "survey", "nps", "testimonial", "complaint"],
  module: {
    id: "feedback",
    label: "Feedback",
    description: "Collect and triage customer feedback.",
    icon: "star",
    entities: [
      {
        key: "feedback",
        label: "Feedback",
        plural: "Feedback",
        icon: "star",
        titleField: "customer",
        boardField: "status",
        seedCount: 12,
        fields: [
          f("customer", "Customer", "text"),
          f("channel", "Channel", "select", { options: ["Email", "WhatsApp", "Web form", "Phone", "In person"] }),
          f("rating", "Rating", "rating"),
          f("sentiment", "Sentiment", "status", { options: ["Positive", "Neutral", "Negative"] }),
          f("comment", "Comment", "longtext"),
          f("status", "Status", "status", { options: ["New", "Reviewed", "Actioned"] }),
          f("receivedAt", "Received", "date", { default: "today" }),
        ],
        actions: [
          row("feedback.notifyTeam", "Notify team", ["notify"]),
          { id: "feedback.importForm", label: "Import form responses", slots: ["forms"], scope: "table" },
        ],
      },
    ],
    stats: [
      { label: "Responses", entity: "feedback", agg: "count", format: "number" },
      { label: "Average rating", entity: "feedback", agg: "avg", field: "rating", format: "decimal" },
      { label: "Negative", entity: "feedback", agg: "count", where: { field: "sentiment", in: ["Negative"] }, format: "number" },
    ],
  },
};

/* ---------------- scrapers ---------------- */
const scrapers: ModuleDef = {
  pitch: "Scraping jobs (target URL, schedule, status) and a table of scraped results.",
  requires: [],
  keywords: ["scrape", "scraper", "scraping", "crawl", "crawler", "monitor prices", "price tracking", "extract data", "data collection", "lead generation scraping"],
  module: {
    id: "scrapers",
    label: "Scrapers",
    description: "Define scraping jobs, run them, and browse results.",
    icon: "globe",
    entities: [
      {
        key: "scrapers",
        label: "Scraper",
        plural: "Scrapers",
        icon: "globe",
        titleField: "name",
        boardField: "status",
        seedCount: 6,
        fields: [
          f("name", "Job", "text", { samples: ["Competitor prices", "Job board leads", "Directory listings", "Product catalog", "Event listings"] }),
          f("targetUrl", "Target URL", "url"),
          f("selector", "Selector / instruction", "text", { hidden: true }),
          f("schedule", "Schedule", "select", { options: ["Manual", "Hourly", "Daily", "Weekly"] }),
          f("status", "Status", "status", { options: ["Idle", "Running", "Done", "Failed"] }),
          f("lastRun", "Last run", "datetime"),
          f("records", "Records", "number", { default: "0" }),
        ],
        actions: [row("scraper.run", "Run now", ["scraping"], true)],
      },
      {
        key: "scrapeResults",
        label: "Result",
        plural: "Results",
        icon: "database",
        titleField: "title",
        seedCount: 16,
        fields: [
          f("job", "Job", "text"),
          f("title", "Title", "text", { samples: ["Acme Widget Pro", "Senior Designer", "City Dental Group", "Summer Sale Tickets", "Blue Ceramic Mug"] }),
          f("sourceUrl", "Source", "url"),
          f("data", "Data", "longtext", { hidden: true }),
          f("scrapedAt", "Scraped", "datetime"),
        ],
        actions: [],
      },
    ],
    stats: [
      { label: "Scraper jobs", entity: "scrapers", agg: "count", format: "number" },
      { label: "Records collected", entity: "scrapers", agg: "sum", field: "records", format: "number" },
      { label: "Failed jobs", entity: "scrapers", agg: "count", where: { field: "status", in: ["Failed"] }, format: "number" },
    ],
  },
};

/* ---------------- appointments ---------------- */
const appointments: ModuleDef = {
  pitch: "Bookings / appointments with status, reminders and calendar sync.",
  requires: [],
  keywords: ["appointment", "appointments", "booking", "bookings", "schedule", "reservation", "session", "class", "visit", "clinic"],
  module: {
    id: "appointments",
    label: "Appointments",
    description: "Bookings with reminders and calendar sync.",
    icon: "calendar",
    entities: [
      {
        key: "appointments",
        label: "Appointment",
        plural: "Appointments",
        icon: "calendar",
        titleField: "client",
        boardField: "status",
        seedCount: 12,
        fields: [
          f("client", "Client", "text"),
          f("email", "Email", "email", { hidden: true }),
          f("phone", "Phone", "phone", { hidden: true }),
          f("service", "Service", "text", { samples: ["Consultation", "Cleaning", "Follow-up", "Training session", "Strategy call", "Check-up"] }),
          f("start", "Start", "datetime"),
          f("durationMin", "Minutes", "number", { default: "30" }),
          f("status", "Status", "status", { options: ["Booked", "Confirmed", "Completed", "No-show", "Cancelled"] }),
          f("notes", "Notes", "longtext", { hidden: true }),
        ],
        actions: [
          row("appointment.remind", "Send reminder", ["whatsapp", "sms", "email"]),
          row("appointment.addToCalendar", "Add to calendar", ["calendar"]),
        ],
      },
    ],
    stats: [
      { label: "Upcoming", entity: "appointments", agg: "count", where: { field: "status", in: ["Booked", "Confirmed"] }, format: "number" },
      { label: "No-shows", entity: "appointments", agg: "count", where: { field: "status", in: ["No-show"] }, format: "number" },
    ],
  },
};

/* ---------------- tickets ---------------- */
const tickets: ModuleDef = {
  pitch: "Support tickets with priority and status.",
  requires: [],
  keywords: ["ticket", "tickets", "support", "helpdesk", "help desk", "issue", "issues", "complaint"],
  module: {
    id: "tickets",
    label: "Support tickets",
    description: "Triage and resolve customer issues.",
    icon: "life-buoy",
    entities: [
      {
        key: "tickets",
        label: "Ticket",
        plural: "Tickets",
        icon: "life-buoy",
        titleField: "subject",
        boardField: "status",
        seedCount: 10,
        fields: [
          f("subject", "Subject", "text", { samples: ["Can't log in", "Billing question", "Feature request", "Delivery delay", "Wrong invoice amount"] }),
          f("requester", "Requester", "text"),
          f("email", "Email", "email", { hidden: true }),
          f("priority", "Priority", "select", { options: ["Low", "Medium", "High", "Urgent"] }),
          f("status", "Status", "status", { options: ["Open", "In progress", "Waiting", "Resolved"] }),
          f("channel", "Channel", "select", { options: ["Email", "WhatsApp", "Web form", "Phone"] }),
          f("description", "Description", "longtext", { hidden: true }),
          f("createdAt", "Created", "date", { default: "today" }),
        ],
        actions: [row("ticket.notify", "Notify team", ["notify"])],
      },
    ],
    stats: [
      { label: "Open tickets", entity: "tickets", agg: "count", where: { field: "status", notIn: ["Resolved"] }, format: "number" },
      { label: "Urgent", entity: "tickets", agg: "count", where: { field: "priority", in: ["Urgent"] }, format: "number" },
    ],
  },
};

export const MODULE_DEFS: ModuleDef[] = [
  contacts,
  deals,
  appointments,
  tasks,
  invoices,
  emailCampaigns,
  whatsappBulk,
  feedback,
  scrapers,
  tickets,
];

export const MODULE_IDS = MODULE_DEFS.map((m) => m.module.id);

export function getModuleDef(id: string): ModuleDef | undefined {
  return MODULE_DEFS.find((m) => m.module.id === id);
}

/** Deep copy so callers can mutate labels/fields without touching the catalog. */
export function cloneModule(id: string): Module {
  const def = getModuleDef(id);
  if (!def) throw new Error(`Unknown module "${id}". Known: ${MODULE_IDS.join(", ")}`);
  return structuredClone(def.module);
}

export function primaryEntity(m: Module): Entity {
  return m.entities[0];
}
