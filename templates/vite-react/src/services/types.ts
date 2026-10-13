/** Canonical input/output per tool category. Swapping tools inside a category never changes the UI. */

export interface BroadcastInput { recipients: string[]; message: string; template?: string }
export interface CampaignInput { recipients: string[]; subject: string; body: string }
export interface BroadcastResult { accepted: number; failed: number }

export interface PaymentLinkInput { reference: string; amount: number; currency: string; customerEmail?: string }
export interface PaymentLinkResult { id: string; url: string }

export interface ScrapeInput { url: string; selector?: string }
export interface ScrapedRecord { title: string; url: string; data: Record<string, unknown> }
export interface ScrapeResult { runId: string; records: ScrapedRecord[] }

export interface NotifyInput { text: string }
export interface NotifyResult { ok: boolean }

export interface EventInput { title: string; start: string; durationMin: number; attendeeEmail?: string }
export interface EventResult { eventId: string }

export interface ImportInput { formId?: string }
export interface ImportResult { rows: Record<string, unknown>[] }

export interface PushContactInput { name: string; email?: string; phone?: string; company?: string }
export interface PushContactResult { externalId: string }

export interface ExportInput { entity: string; rows: Record<string, unknown>[] }
export interface ExportResult { updated: number }
