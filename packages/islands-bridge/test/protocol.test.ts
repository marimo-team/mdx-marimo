import { describe, expect, it } from "vite-plus/test";
import {
  MARIMO_PAGE_PROTOCOL_VERSION,
  isCompiledMarimoPage,
  isMarimoPageCellPayload,
  pageCellPayload,
  type CompiledMarimoPage,
} from "../src/protocol";

describe("marimo page protocol", () => {
  it("creates one mount payload from a page and authored cell", () => {
    const page = compiledPage();

    const payload = pageCellPayload(page, page.cells[0]!);

    expect(isCompiledMarimoPage(page)).toBe(true);
    expect(isMarimoPageCellPayload(payload)).toBe(true);
    expect(payload.app).toBe(page.app);
    expect(payload.cell).toBe(page.cells[0]);
  });

  it("rejects payloads from another protocol version", () => {
    expect(
      isMarimoPageCellPayload({
        protocolVersion: 2,
        app: null,
        cell: { index: 0, html: "", options: {} },
      }),
    ).toBe(false);
  });

  it("rejects malformed runtime assets", () => {
    const page = compiledPage();
    const app = page.app!;
    const malformedAssets = [
      { ...app.assets, moduleScripts: [null] },
      { ...app.assets, links: [null] },
      { ...app.assets, headTags: [null] },
    ];

    for (const assets of malformedAssets) {
      const malformedApp = { ...app, assets };
      expect(isCompiledMarimoPage({ ...page, app: malformedApp })).toBe(false);
      expect(
        isMarimoPageCellPayload({
          protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
          app: malformedApp,
          cell: page.cells[0],
        }),
      ).toBe(false);
    }
  });

  it("rejects incomplete compiled cell options", () => {
    const page = compiledPage();
    const malformedCell = { ...page.cells[0], options: {} };

    expect(isCompiledMarimoPage({ ...page, cells: [malformedCell] })).toBe(false);
    expect(
      isMarimoPageCellPayload({
        protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
        app: page.app,
        cell: malformedCell,
      }),
    ).toBe(false);
  });

  it("rejects malformed page and cell diagnostics", () => {
    const page = compiledPage();
    const malformedCell = { ...page.cells[0], diagnostics: [null] };

    expect(isCompiledMarimoPage({ ...page, diagnostics: [null] })).toBe(false);
    expect(isCompiledMarimoPage({ ...page, cells: [malformedCell] })).toBe(false);
    expect(
      isMarimoPageCellPayload({
        protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
        app: page.app,
        cell: malformedCell,
      }),
    ).toBe(false);
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
        headTags: [{ tag: "meta", attrs: { name: "theme-color" }, text: "black" }],
        version: "1.0.0",
      },
      notebookCode: "x = 1",
      runtimePayload: { ready: true },
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
          sql: { engine: "duckdb", outputName: "result" },
          name: "cell_name",
          column: 0,
        },
        diagnostics: [{ severity: "warning", message: "Example warning", cellIndex: 0, line: 1 }],
      },
    ],
    diagnostics: [{ severity: "error", message: "Example error", cellIndex: 0, line: 1 }],
  };
}
