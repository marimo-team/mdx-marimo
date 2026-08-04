import { describe, expect, it } from "vite-plus/test";
import {
  MARIMO_PAGE_PROTOCOL_VERSION,
  encodePageCellPayload,
  isCompiledMarimoPage,
  isMarimoPageCellPayload,
  isMarimoPageCellReferencePayload,
  pageCellPayload,
  projectPageCellPayloads,
  type CompiledMarimoPage,
} from "../src/protocol";

describe("marimo page protocol", () => {
  it("projects included cells with one app carrier", () => {
    const page = compiledPage();
    page.cells.splice(1, 0, {
      ...page.cells[0]!,
      index: 1,
      options: {
        ...page.cells[0]!.options,
        render: { ...page.cells[0]!.options.render, include: false },
      },
    });
    page.cells.push({ ...page.cells[0]!, index: 2 });

    const payloads = projectPageCellPayloads(page);

    expect(payloads).toHaveLength(3);
    expect(isMarimoPageCellPayload(payloads[0])).toBe(true);
    expect(payloads[0]).toMatchObject({ app: { id: "marimo-test" }, cell: { index: 0 } });
    expect(payloads[1]).toBeNull();
    expect(isMarimoPageCellReferencePayload(payloads[2])).toBe(true);
    expect(payloads[2]).toMatchObject({ appId: "marimo-test", cell: { index: 2 } });
    expect(payloads[0]?.cell).not.toHaveProperty("output");
    expect(payloads[2]?.cell).not.toHaveProperty("output");
  });

  it("projects static cells as self-contained payloads", () => {
    const page = { ...compiledPage(), app: null };
    page.cells.push({ ...page.cells[0]!, index: 1 });

    const payloads = projectPageCellPayloads(page);

    expect(payloads).toMatchObject([
      { app: null, cell: { index: 0 } },
      { app: null, cell: { index: 1 } },
    ]);
  });

  it("rejects compiled cells that do not match authored positions", () => {
    const page = compiledPage();
    page.cells[0] = { ...page.cells[0]!, index: 1 };

    expect(() => projectPageCellPayloads(page)).toThrow("returned cell indices [1]; expected [0]");
  });

  it("encodes payloads as base64url JSON", () => {
    const page = compiledPage();
    const payload = pageCellPayload(page, {
      ...page.cells[0]!,
      html: "<p>Grüße 👋</p>",
    });

    const encoded = encodePageCellPayload(payload);
    const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(atob(padded), (value) => value.charCodeAt(0))),
    );

    expect(decoded).toEqual(payload);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("validates compiler and browser records at the v2 boundary", () => {
    const page = compiledPage();
    const payload = pageCellPayload(page, page.cells[0]!);

    expect(MARIMO_PAGE_PROTOCOL_VERSION).toBe(2);
    expect(isCompiledMarimoPage(page)).toBe(true);
    expect(isMarimoPageCellPayload(payload)).toBe(true);
    expect(isCompiledMarimoPage({ ...page, cells: [payload.cell] })).toBe(false);
    expect(isMarimoPageCellPayload({ ...payload, protocolVersion: 1 })).toBe(false);
  });
});

function compiledPage(): CompiledMarimoPage {
  return {
    protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
    app: {
      id: "marimo-test",
      runtimeCellCount: 1,
      assets: {
        links: [{ href: "/style.css", rel: "stylesheet" }],
        moduleScripts: ["/runtime.js"],
      },
      notebookCode: "x = 1",
    },
    cells: [
      {
        index: 0,
        html: "<marimo-island></marimo-island>",
        options: {
          language: "python",
          render: {
            source: false,
            output: true,
            include: true,
            editor: false,
            error: true,
            serverOutput: true,
          },
          execution: { enabled: true },
          marimo: { disabled: false, unparsable: false },
        },
        output: {
          mimetype: "text/plain",
          data: "1",
          html: "<span>1</span>",
        },
      },
    ],
    diagnostics: [],
  };
}
