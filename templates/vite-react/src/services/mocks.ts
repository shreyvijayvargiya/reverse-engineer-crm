import type {
  BroadcastInput, BroadcastResult, CampaignInput, EventInput, EventResult, ExportInput, ExportResult,
  ImportInput, ImportResult, NotifyInput, NotifyResult, PaymentLinkInput, PaymentLinkResult,
  PushContactInput, PushContactResult, ScrapeInput, ScrapeResult,
} from "./types";

const rid = () => Math.random().toString(36).slice(2, 10);

function broadcast(input: BroadcastInput | CampaignInput): BroadcastResult {
  const failed = Math.floor(input.recipients.length * 0.04);
  return { accepted: input.recipients.length - failed, failed };
}

/** Mock behaviour per category. Delete nothing here when going live; the stubs just stop calling these. */
export const mocks = {
  whatsapp: (i: BroadcastInput): BroadcastResult => broadcast(i),
  sms: (i: BroadcastInput): BroadcastResult => broadcast(i),
  email: (i: CampaignInput): BroadcastResult => broadcast(i),
  payments: (i: PaymentLinkInput): PaymentLinkResult => ({ id: `plink_${rid()}`, url: `https://pay.example.com/${encodeURIComponent(i.reference)}-${rid()}` }),
  scraping: (i: ScrapeInput): ScrapeResult => {
    const n = 3 + Math.floor(Math.random() * 6);
    return {
      runId: `run_${rid()}`,
      records: Array.from({ length: n }, (_, k) => ({
        title: `Item ${k + 1} from ${(() => { try { return new URL(i.url).hostname; } catch { return "source"; } })()}`,
        url: `${i.url.replace(/\/$/, "")}/item-${k + 1}`,
        data: { price: Math.round(10 + Math.random() * 190), inStock: Math.random() > 0.2 },
      })),
    };
  },
  notify: (_i: NotifyInput): NotifyResult => ({ ok: true }),
  calendar: (_i: EventInput): EventResult => ({ eventId: `evt_${rid()}` }),
  forms: (_i: ImportInput): ImportResult => ({
    rows: [
      { customer: "Form respondent A", rating: 5, comment: "Loved it, very quick." },
      { customer: "Form respondent B", rating: 2, comment: "Took too long to get a reply." },
      { customer: "Form respondent C", rating: 4, comment: "Good overall." },
    ],
  }),
  crm: (_i: PushContactInput): PushContactResult => ({ externalId: `ext_${rid()}` }),
  sheets: (i: ExportInput): ExportResult => ({ updated: i.rows.length }),
};
