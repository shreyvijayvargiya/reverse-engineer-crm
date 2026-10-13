import { blueprint } from "../generated/blueprint";
import { services } from "../services";
import { store } from "./store";
import type { Action, Entity, Row } from "./types";
import { formatDateTime, nowLocalIso, todayIso } from "./utils";

/**
 * Behaviour behind each action id declared in blueprint.json. Every integration call goes through a service
 * stub (src/services/*), so this file never changes when you swap tools or go live.
 */

type Svc = Record<string, (input: any) => Promise<any>>;
export interface ActionContext {
  entity: Entity;
  row?: Row;
  notify: (message: string, kind?: "success" | "error") => void;
}

const svcs = services as unknown as Record<string, Svc>;

/** First slot that has a configured tool. Returns null when the action needs a tool and none is set up. */
export function resolveSlot(action: Action): string | null | undefined {
  if (action.slots.length === 0) return undefined; // local-only action
  return action.slots.find((s) => svcs[s]) ?? null;
}

function recipientsFor(audience: unknown, field: "phone" | "email"): string[] {
  const contactsEntity = blueprint.modules.flatMap((m) => m.entities).find((e) => e.key === "contacts");
  const gated = contactsEntity?.fields.some((f) => f.key === "marketingOptIn");
  return store
    .get("contacts")
    .filter((c) => audience === "All contacts" || c.status === audience)
    .filter((c) => !gated || c.marketingOptIn === true)
    .map((c) => String(c[field] ?? "").trim())
    .filter(Boolean);
}

function hasEntity(key: string) {
  return blueprint.modules.some((m) => m.entities.some((e) => e.key === key));
}

type Handler = (ctx: ActionContext, slot: string | undefined) => Promise<void>;

const handlers: Record<string, Handler> = {
  async "broadcast.send"({ entity, row, notify }, slot) {
    if (!row || !slot) return;
    const recipients = recipientsFor(row.audience, "phone");
    if (!recipients.length) throw new Error("No opted-in contacts with a phone number match this audience.");
    const res = await svcs[slot].sendBroadcast({ recipients, message: String(row.message ?? "") });
    store.update(entity.key, row.id, {
      status: res.accepted === 0 ? "Failed" : "Sent",
      sent: res.accepted,
      failed: res.failed,
      sentAt: nowLocalIso(),
    });
    store.log(`Broadcast "${row.name}" sent to ${res.accepted} contacts`);
    notify(`Sent to ${res.accepted} of ${recipients.length} contacts (${res.failed} failed)`);
  },

  async "campaign.sendEmail"({ entity, row, notify }, slot) {
    if (!row || !slot) return;
    const recipients = recipientsFor(row.audience, "email");
    if (!recipients.length) throw new Error("No opted-in contacts with an email address match this audience.");
    const res = await svcs[slot].sendCampaign({ recipients, subject: String(row.subject ?? ""), body: String(row.body ?? "") });
    store.update(entity.key, row.id, { status: res.accepted === 0 ? "Draft" : "Sent", sent: res.accepted, failed: res.failed });
    store.log(`Campaign "${row.name}" sent to ${res.accepted} contacts`);
    notify(`Sent to ${res.accepted} of ${recipients.length} contacts`);
  },

  async "invoice.paymentLink"({ entity, row, notify }, slot) {
    if (!row || !slot) return;
    const res = await svcs[slot].createPaymentLink({
      reference: String(row.number),
      amount: Number(row.amount) || 0,
      currency: blueprint.currency,
      customerEmail: row.email ? String(row.email) : undefined,
    });
    store.update(entity.key, row.id, { paymentLink: res.url, status: row.status === "Draft" ? "Sent" : row.status });
    store.log(`Payment link created for ${row.number}`);
    try {
      await navigator.clipboard.writeText(res.url);
      notify("Payment link created and copied to clipboard");
    } catch {
      notify(`Payment link created: ${res.url}`);
    }
  },

  async "invoice.markPaid"({ entity, row, notify }) {
    if (!row) return;
    store.update(entity.key, row.id, { status: "Paid" });
    store.log(`Invoice ${row.number} marked paid`);
    notify("Invoice marked as paid");
  },

  async "scraper.run"({ entity, row, notify }, slot) {
    if (!row || !slot) return;
    store.update(entity.key, row.id, { status: "Running" });
    try {
      const res = await svcs[slot].runScrape({ url: String(row.targetUrl), selector: row.selector ? String(row.selector) : undefined });
      if (hasEntity("scrapeResults")) {
        for (const rec of res.records) {
          store.insert("scrapeResults", {
            job: row.name,
            title: rec.title,
            sourceUrl: rec.url,
            data: JSON.stringify(rec.data),
            scrapedAt: nowLocalIso(),
          });
        }
      }
      store.update(entity.key, row.id, {
        status: "Done",
        lastRun: nowLocalIso(),
        records: (Number(row.records) || 0) + res.records.length,
      });
      store.log(`Scraper "${row.name}" collected ${res.records.length} records`);
      notify(`Collected ${res.records.length} records`);
    } catch (err) {
      store.update(entity.key, row.id, { status: "Failed", lastRun: nowLocalIso() });
      throw err;
    }
  },

  async "feedback.notifyTeam"({ entity, row, notify }, slot) {
    if (!row || !slot) return;
    await svcs[slot].postMessage({ text: `${row.rating}/5 feedback from ${row.customer}: ${row.comment}` });
    if (row.status === "New") store.update(entity.key, row.id, { status: "Reviewed" });
    notify("Team notified");
  },

  async "feedback.importForm"({ notify }, slot) {
    if (!slot) return;
    const res = await svcs[slot].importResponses({});
    for (const r of res.rows) {
      const rating = Number(r.rating) || 3;
      store.insert("feedback", {
        customer: String(r.customer ?? "Unknown"),
        channel: "Web form",
        rating,
        sentiment: rating >= 4 ? "Positive" : rating === 3 ? "Neutral" : "Negative",
        comment: String(r.comment ?? ""),
        status: "New",
        receivedAt: todayIso(),
      });
    }
    store.log(`Imported ${res.rows.length} form responses`);
    notify(`Imported ${res.rows.length} responses`);
  },

  async "appointment.remind"({ row, notify }, slot) {
    if (!row || !slot) return;
    const text = `Reminder: ${row.service} on ${formatDateTime(row.start)}.`;
    if (slot === "email") {
      if (!row.email) throw new Error("This appointment has no email address.");
      await svcs[slot].sendCampaign({ recipients: [String(row.email)], subject: "Appointment reminder", body: text });
    } else {
      if (!row.phone) throw new Error("This appointment has no phone number.");
      await svcs[slot].sendBroadcast({ recipients: [String(row.phone)], message: text });
    }
    store.log(`Reminder sent to ${row.client}`);
    notify(`Reminder sent to ${row.client}`);
  },

  async "appointment.addToCalendar"({ entity, row, notify }, slot) {
    if (!row || !slot) return;
    await svcs[slot].createEvent({
      title: `${row.service} - ${row.client}`,
      start: String(row.start),
      durationMin: Number(row.durationMin) || 30,
      attendeeEmail: row.email ? String(row.email) : undefined,
    });
    if (row.status === "Booked") store.update(entity.key, row.id, { status: "Confirmed" });
    notify("Added to calendar");
  },

  async "ticket.notify"({ row, notify }, slot) {
    if (!row || !slot) return;
    await svcs[slot].postMessage({ text: `[${row.priority}] ${row.subject} from ${row.requester}` });
    notify("Team notified");
  },

  async "contact.pushToCrm"({ row, notify }, slot) {
    if (!row || !slot) return;
    const res = await svcs[slot].pushContact({
      name: String(row.name),
      email: row.email ? String(row.email) : undefined,
      phone: row.phone ? String(row.phone) : undefined,
      company: row.company ? String(row.company) : undefined,
    });
    notify(`Synced (external id ${res.externalId})`);
  },

  async "table.exportSheets"({ entity, notify }, slot) {
    if (!slot) return;
    const rows = store.get(entity.key);
    const res = await svcs[slot].exportRows({ entity: entity.key, rows });
    notify(`Exported ${res.updated} rows`);
  },
};

export async function runAction(action: Action, ctx: ActionContext): Promise<void> {
  const slot = resolveSlot(action);
  if (slot === null) {
    ctx.notify(`No ${action.slots.join(" / ")} tool is configured for this action. See Settings.`, "error");
    return;
  }
  const handler = handlers[action.id];
  if (!handler) {
    ctx.notify(`No handler for "${action.id}". Add one in src/lib/actions.ts.`, "error");
    return;
  }
  try {
    await handler(ctx, slot ?? undefined);
  } catch (err) {
    ctx.notify(err instanceof Error ? err.message : "Action failed", "error");
  }
}
