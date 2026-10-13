import { describe, expect, it } from "vitest";
import { expandBrief } from "../src/plan/expand.js";
import { planOffline } from "../src/plan/offline.js";

const ids = (desc: string) => planOffline(desc).modules.map((m) => m.id);

describe("offline planner: the use cases people actually ask for", () => {
  it("scraping dashboard needs scrapers only, no contacts", () => {
    expect(ids("I need a scraping agents dashboard")).toEqual(["scrapers"]);
  });
  it("WhatsApp bulk messaging pulls in contacts and gates on opt-in", () => {
    expect(ids("WhatsApp bulk messaging for my customers")).toEqual(expect.arrayContaining(["contacts", "whatsapp_bulk"]));
    const bp = expandBrief(planOffline("WhatsApp bulk messaging for my customers"));
    const contacts = bp.modules.find((m) => m.id === "contacts")!.entities[0];
    expect(contacts.fields.some((f) => f.key === "marketingOptIn")).toBe(true);
    expect(bp.primaryTools.whatsapp).toBe("whatsapp-cloud");
  });
  it("email CRM", () => {
    expect(ids("a crm for emailing my leads")).toEqual(expect.arrayContaining(["contacts", "email_campaigns"]));
  });
  it("feedback CRM", () => {
    expect(ids("collect customer feedback and ratings")).toContain("feedback");
  });
  it("invoicing CRM", () => {
    expect(ids("I send invoices to clients")).toContain("invoices");
  });
  it("vertical vocabulary: dental clinic gets Patients", () => {
    const brief = planOffline("I run a dental clinic");
    expect(brief.modules.find((m) => m.id === "contacts")?.label).toBe("Patients");
    expect(brief.modules.map((m) => m.id)).toEqual(expect.arrayContaining(["appointments", "invoices"]));
    expect(brief.extraFields.some((f) => f.key === "dateOfBirth")).toBe(true);
  });
  it("named vendors are honoured", () => {
    const brief = planOffline("track invoices, take payment with razorpay and post alerts to slack");
    expect(brief.tools).toEqual(expect.arrayContaining(["razorpay", "slack"]));
  });
  it("Twilio resolves to the WhatsApp variant when the text says WhatsApp", () => {
    expect(planOffline("whatsapp broadcasts through twilio").tools).toContain("twilio-whatsapp");
  });
  it("does not invent tools nobody asked for", () => {
    const bp = expandBrief(planOffline("I run a dental clinic"));
    expect(bp.tools).not.toContain("hubspot");
    expect(bp.tools).not.toContain("slack");
  });
});
