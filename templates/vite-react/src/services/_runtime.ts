/**
 * Every integration call goes through `invoke`.
 *
 * - No VITE_API_BASE_URL: returns the mock, so the whole UI works with zero backend.
 * - VITE_API_BASE_URL set: POSTs the input as JSON to `${BASE}/<tool>/<method>` and returns the JSON response.
 *   Implement those routes on your backend (see openapi.yaml). Secrets stay on the server, never in the browser.
 */
const BASE = import.meta.env.VITE_API_BASE_URL;

export const isLive = Boolean(BASE);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function invoke<I, O>(tool: string, method: string, input: I, mock: (input: I) => O | Promise<O>): Promise<O> {
  if (BASE) {
    const res = await fetch(`${BASE.replace(/\/$/, "")}/${tool}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`${tool}.${method} failed: ${res.status} ${await res.text().catch(() => "")}`.trim());
    return (await res.json()) as O;
  }
  await sleep(450 + Math.random() * 650);
  return mock(input);
}
