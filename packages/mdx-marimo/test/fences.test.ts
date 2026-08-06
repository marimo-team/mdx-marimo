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
          editor: false,
        },
        column: 2,
      },
    });
  });

  it("parses boolean and string options", () => {
    expect(
      parseFenceOptions("sql", 'marimo output=false query="result" engine=duckdb').options,
    ).toEqual({
      language: "sql",
      render: {
        output: false,
      },
      sql: {
        outputName: "result",
        engine: "duckdb",
      },
    });
  });

  it("scopes SQL options to SQL cells", () => {
    expect(parseFenceOptions("python", 'marimo query="result" engine=duckdb').options).toEqual({
      language: "python",
    });
  });

  it("renders authored source when the editor is enabled", () => {
    expect(parseFenceOptions("markdown", "marimo editor=true").options).toEqual({
      language: "markdown",
      render: {
        source: true,
        editor: true,
      },
    });
  });

  it("preserves unparsable source and disables execution", () => {
    expect(parseFenceOptions("python", "marimo unparsable=true").options).toEqual({
      language: "python",
      render: { source: true },
      execution: { enabled: false },
      marimo: { unparsable: true },
    });
  });

  it("disables execution for disabled cells", () => {
    expect(parseFenceOptions("python", "marimo eval=true disabled=true").options).toEqual({
      language: "python",
      execution: { enabled: false },
      marimo: { disabled: true },
    });
  });

  it("hides unparsable source when hide-code is set", () => {
    expect(parseFenceOptions("python", "marimo unparsable=true hide-code=true").options).toEqual({
      language: "python",
      render: {
        source: false,
        editor: false,
      },
      execution: { enabled: false },
      marimo: { unparsable: true },
    });
  });
});
