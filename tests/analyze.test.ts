import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeCsv, inferType, parseCsv } from "../src/analyze/csv.js";
import { analyzeHar } from "../src/analyze/har.js";
import { evidenceToText } from "../src/analyze/index.js";
import { evidenceToEntities } from "../src/plan/offline.js";

const dir = mkdtempSync(join(tmpdir(), "rcrm-"));

describe("csv", () => {
  it("parses quotes, escaped quotes and embedded newlines", () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi"""\n"line1\nline2",z\n')).toEqual([
      ["a", "b"],
      ["x, y", 'he said "hi"'],
      ["line1\nline2", "z"],
    ]);
  });
  it("infers types", () => {
    expect(inferType("Email", ["a@b.co", "c@d.io"])).toBe("email");
    expect(inferType("Price", ["10", "20.5"])).toBe("currency");
    expect(inferType("Joined", ["2024-01-02", "2024-02-03"])).toBe("date");
    expect(inferType("Phone", ["+1 555 010 2030", "555-010-2031"])).toBe("phone");
    expect(inferType("Stage", ["New", "Won", "New", "Lost", "Won", "New", "Won", "Lost"])).toBe("status");
  });
  it("turns a leads CSV into a custom entity", () => {
    const f = join(dir, "leads.csv");
    writeFileSync(f, "Full name,Email,Stage\nAda,ada@x.io,New\nBo,bo@x.io,Won\nCy,cy@x.io,New\nDi,di@x.io,Lost\nEd,ed@x.io,Won\nFy,fy@x.io,New\n");
    const ev = analyzeCsv(f);
    expect(ev.rowCount).toBe(6);
    const [entity] = evidenceToEntities([ev]);
    expect(entity.key).toBe("leads");
    expect(entity.fields.map((x) => x.key)).toEqual(["fullName", "email", "stage"]);
    expect(entity.fields[2].type).toBe("status");
  });
  it("omits category values with includeValues:false", () => {
    const f = join(dir, "x.csv");
    writeFileSync(f, "Stage\nNew\nWon\nNew\nLost\nWon\nNew\nWon\nLost\n");
    expect(analyzeCsv(f, { includeValues: false }).columns[0].values).toBeUndefined();
  });
});

describe("har", () => {
  it("keeps endpoint shapes and never leaks headers, tokens or values", () => {
    const f = join(dir, "s.har");
    writeFileSync(
      f,
      JSON.stringify({
        log: {
          entries: [
            {
              request: { method: "GET", url: "https://app.example.com/api/v1/deals?token=SECRETQUERY", headers: [{ name: "Authorization", value: "Bearer SECRETTOKEN" }] },
              response: { status: 200, content: { mimeType: "application/json", text: JSON.stringify({ data: [{ id: 1, title: "SECRETVALUE", amount: 12.5 }] }) } },
            },
            { request: { method: "GET", url: "https://app.example.com/assets/app.js" }, response: { status: 200, content: { mimeType: "text/javascript" } } },
            {
              request: { method: "GET", url: "https://app.example.com/api/v1/deals/123" },
              response: { status: 200, content: { mimeType: "application/json", text: "{}" } },
            },
          ],
        },
      }),
    );
    const ev = analyzeHar(f);
    expect(ev.endpoints.map((e) => e.path)).toEqual(["/api/v1/deals", "/api/v1/deals/{id}"]);
    expect(ev.endpoints[0].shape).toEqual({ id: "number", title: "string", amount: "number" });
    const text = JSON.stringify(ev) + evidenceToText([ev]);
    for (const secret of ["SECRETTOKEN", "SECRETQUERY", "SECRETVALUE"]) expect(text).not.toContain(secret);
  });
});
