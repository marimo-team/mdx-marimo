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
    expect(parseFenceOptions("sql", 'marimo output=false query="result" engine=duckdb')).toEqual({
      diagnostics: [],
      options: {
        language: "sql",
        render: {
          output: false,
        },
        sql: {
          outputName: "result",
          engine: "duckdb",
        },
      },
    });
  });

  it.each(["sql", "markdown"] as const)(
    "renders authored %s source when the editor is enabled",
    (language) => {
      expect(parseFenceOptions(language, "marimo editor=true")).toEqual({
        diagnostics: [],
        options: {
          language,
          render: {
            source: true,
            editor: true,
          },
        },
      });
    },
  );

  it("preserves unparsable source and disables execution", () => {
    expect(parseFenceOptions("python", "marimo unparsable=true")).toEqual({
      diagnostics: [],
      options: {
        language: "python",
        render: { source: true },
        execution: { enabled: false },
        marimo: { unparsable: true },
      },
    });
  });

  it("disables execution for disabled cells", () => {
    expect(parseFenceOptions("python", "marimo eval=true disabled=true")).toEqual({
      diagnostics: [],
      options: {
        language: "python",
        execution: { enabled: false },
        marimo: { disabled: true },
      },
    });
  });

  it("hides unparsable source when hide-code is set", () => {
    expect(parseFenceOptions("python", "marimo unparsable=true hide-code=true")).toEqual({
      diagnostics: [],
      options: {
        language: "python",
        render: {
          source: false,
          editor: false,
        },
        execution: { enabled: false },
        marimo: { unparsable: true },
      },
    });
  });
});
