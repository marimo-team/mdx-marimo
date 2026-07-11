import { describe, expect, it } from "vite-plus/test";
import { fenceLanguage, isMarimoConfigFence, isMarimoFence, parseFenceOptions } from "../src";

describe("marimo fence metadata", () => {
  it("detects marimo fences", () => {
    expect(isMarimoFence("python", "marimo echo=true")).toBe(true);
    expect(isMarimoFence("sql", 'marimo query="result"')).toBe(true);
    expect(isMarimoFence("markdown.marimo", "")).toBe(true);
    expect(isMarimoFence("python", "")).toBe(false);
    expect(isMarimoFence("javascript.marimo", "")).toBe(false);
  });

  it("detects page metadata fences", () => {
    expect(isMarimoConfigFence("marimo-config")).toBe(true);
    expect(isMarimoConfigFence("python")).toBe(false);
  });

  it("normalizes languages and options", () => {
    expect(fenceLanguage("python.marimo")).toBe("python");
    expect(parseFenceOptions("python", 'marimo echo=true hide_code="true" column=2')).toEqual({
      diagnostics: [],
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
        column: 2,
      },
    });
  });

  it("parses boolean and string options", () => {
    expect(parseFenceOptions("sql", 'marimo output=false query="result" engine=duckdb')).toEqual({
      diagnostics: [],
      options: {
        language: "sql",
        render: {
          source: false,
          output: false,
          include: true,
          editor: false,
          error: true,
          serverOutput: true,
        },
        execution: { enabled: true },
        marimo: { disabled: false, unparsable: false },
        sql: {
          outputName: "result",
          engine: "duckdb",
        },
      },
    });
  });

  it("preserves unparsable source and disables execution", () => {
    expect(parseFenceOptions("python", "marimo unparsable=true")).toEqual({
      diagnostics: [],
      options: {
        language: "python",
        render: {
          source: true,
          output: true,
          include: true,
          editor: false,
          error: true,
          serverOutput: true,
        },
        execution: { enabled: false },
        marimo: { disabled: false, unparsable: true },
      },
    });
  });
});
