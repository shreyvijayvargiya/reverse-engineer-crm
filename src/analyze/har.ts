import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { HarEndpoint, HarEvidence } from "./types.js";

/**
 * Reads a HAR you captured from YOUR OWN session in a tool you are allowed to inspect.
 * Only method, path template, status and the *key names/types* of JSON responses are kept.
 * Headers, cookies, tokens, query values and body values are never read into the result.
 */

const STATIC = /\.(js|mjs|css|png|jpe?g|gif|svg|ico|woff2?|ttf|map|webp|avif)(\?|$)/i;

function templatePath(pathname: string): string {
  return pathname
    .split("/")
    .map((seg) => (/^\d+$/.test(seg) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) || /^[0-9a-f]{20,}$/i.test(seg) ? "{id}" : seg))
    .join("/");
}

function jsonType(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

export function analyzeHar(path: string): HarEvidence {
  const har = JSON.parse(readFileSync(path, "utf8")) as { log?: { entries?: any[] } };
  const entries = har.log?.entries ?? [];
  if (!Array.isArray(entries) || entries.length === 0) throw new Error(`${path}: no entries found in HAR`);

  const byKey = new Map<string, HarEndpoint>();
  const hostCount = new Map<string, number>();
  for (const e of entries) {
    let url: URL;
    try {
      url = new URL(e?.request?.url);
    } catch {
      continue;
    }
    if (STATIC.test(url.pathname)) continue;
    const mime: string = e?.response?.content?.mimeType ?? "";
    if (!mime.includes("json")) continue;
    hostCount.set(url.host, (hostCount.get(url.host) ?? 0) + 1);
    const method: string = e.request.method ?? "GET";
    const key = `${method} ${url.host}${templatePath(url.pathname)}`;
    if (byKey.has(key)) continue;
    const ep: HarEndpoint = { method, path: templatePath(url.pathname), status: e.response?.status ?? 0 };
    const text: string | undefined = e.response?.content?.text;
    if (text) {
      try {
        let body: unknown = JSON.parse(text);
        // Unwrap { data: [...] } / { results: [...] } style envelopes.
        if (body && typeof body === "object" && !Array.isArray(body)) {
          const inner = Object.values(body as Record<string, unknown>).find((v) => Array.isArray(v) && v.length > 0);
          if (inner) {
            body = inner;
          }
        }
        if (Array.isArray(body)) {
          ep.isList = true;
          body = body[0];
        }
        if (body && typeof body === "object") {
          ep.shape = Object.fromEntries(Object.entries(body as Record<string, unknown>).map(([k, v]) => [k, jsonType(v)]));
        }
      } catch {
        /* non-JSON despite mime: ignore body */
      }
    }
    byKey.set(key, ep);
  }
  const host = [...hostCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  return { kind: "har", file: basename(path), host, endpoints: [...byKey.values()].slice(0, 60) };
}
