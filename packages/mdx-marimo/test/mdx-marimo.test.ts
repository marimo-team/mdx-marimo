import { compile, type CompileOptions } from "@mdx-js/mdx";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  MARIMO_PAGE_PROTOCOL_VERSION,
  type CompiledMarimoPage,
  type MarimoCellOptions,
  type MarimoPageCompiler,
  type MarimoPageRequest,
} from "@marimo-team/islands-bridge/protocol";
import { remarkMarimo } from "../src/remark";

describe("remarkMarimo", () => {
  it("collects one page request and emits protocol-backed custom elements", async () => {
    let request: MarimoPageRequest | undefined;
    const file = await compile("```python marimo echo=true\nx = 1\n```", {
      jsx: true,
      remarkPlugins: [
        [
          remarkMarimo,
          {
            compile: compiler((payload) => {
              request = payload;
            }),
          },
        ],
      ],
    });

    const compiled = String(file);
    expect(request).toMatchObject({
      protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
      cells: [
        {
          index: 0,
          source: "x = 1",
          options: {
            language: "python",
            render: { source: true, output: true, include: true },
            execution: { enabled: true },
          },
        },
      ],
    });
    expect(compiled).toContain("<marimo-mdx-island ");
    expect(compiled).toContain('class="marimo-island-host"');
    expect(compiled).toContain('data-marimo-payload-encoding="base64url"');
    expect(compiled).toMatch(/data-marimo-payload="[A-Za-z0-9_-]+"/);
    expect(compiled).toContain('data-marimo-app-id="marimo-test"');
    expect(compiled).not.toContain("<template");
  });

  it("configures the custom element, theme, and runtime import", async () => {
    const file = await compile("```python marimo\nx = 1\n```", {
      jsx: true,
      remarkPlugins: [
        [
          remarkMarimo,
          {
            element: {
              name: "marimo-example-island",
              runtimeImport: "marimo-runtime/auto",
              theme: "dark",
            },
            compile: compiler(),
          },
        ],
      ],
    });

    const compiled = String(file);
    expect(compiled).toContain('import "marimo-runtime/auto"');
    expect(compiled).toContain("<marimo-example-island ");
    expect(compiled).toContain('data-marimo-theme-mode="dark"');
  });

  it("keeps ordinary fences and nested MDX structure intact", async () => {
    const ordinary = await compile("```python\nx = 1\n```", {
      jsx: true,
      remarkPlugins: [[remarkMarimo, { compile: compiler() }]],
    });
    const nested = await compile("> ```python marimo\n> x = 1\n> ```", {
      jsx: true,
      remarkPlugins: [[remarkMarimo, { compile: compiler() }]],
    });

    expect(String(ordinary)).toContain(
      '<_components.pre><_components.code className="language-python"',
    );
    const blockquote = String(nested).match(
      /<_components\.blockquote>([\s\S]*?)<\/_components\.blockquote>/,
    )?.[1];
    expect(blockquote).toContain("<marimo-mdx-island ");
  });

  it("maps config, public filename, and configured identity into the request", async () => {
    let request: MarimoPageRequest | undefined;
    await compile(
      {
        value: [
          "```marimo-config",
          'dependencies = ["numpy"]',
          "```",
          "",
          "```python marimo",
          "__file__",
          "```",
        ].join("\n"),
        path: join(process.cwd(), "apps", "docs", "page.mdx"),
      },
      {
        jsx: true,
        remarkPlugins: [
          [
            remarkMarimo,
            {
              cwd: process.cwd(),
              identity: ({ filename }: { filename: string; filePath: string | undefined }) =>
                `page:${filename}`,
              compile: compiler((payload) => {
                request = payload;
              }),
            },
          ],
        ],
      },
    );

    expect(request).toMatchObject({
      filename: join("apps", "docs", "page.mdx"),
      identity: `page:${join("apps", "docs", "page.mdx")}`,
      metadata: { pyproject: 'dependencies = ["numpy"]' },
    });
  });

  it("stabilizes virtual mdx-bundler page identity across builds", async () => {
    const requests: MarimoPageRequest[] = [];
    const source = "Intro\n\n```python marimo\nx = 1\n```";
    const options: CompileOptions = {
      jsx: true,
      remarkPlugins: [
        [
          remarkMarimo,
          {
            compile: compiler((request) => requests.push(request)),
          },
        ],
      ],
    };

    await compile(
      { value: source, path: join(process.cwd(), "_mdx_bundler_entry_point-first.mdx") },
      options,
    );
    await compile(
      { value: source, path: join(process.cwd(), "_mdx_bundler_entry_point-second.mdx") },
      options,
    );
    await compile(
      {
        value: source.replace("Intro", "Changed intro"),
        path: join(process.cwd(), "_mdx_bundler_entry_point-third.mdx"),
      },
      options,
    );

    expect(requests.map((request) => request.filename)).toEqual([
      "document.mdx",
      "document.mdx",
      "document.mdx",
    ]);
    expect(requests[0]!.identity).toBe(requests[1]!.identity);
    expect(requests[0]!.identity).not.toBe(requests[2]!.identity);
    expect(requests[0]!.identity).toMatch(/^document:/);
  });

  it("checks compiler cell count and ordering", async () => {
    const missing: CompileOptions = {
      jsx: true,
      remarkPlugins: [
        [
          remarkMarimo,
          {
            compile: async () => ({
              protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
              app: null,
              cells: [],
              diagnostics: [],
            }),
          },
        ],
      ],
    };
    const reordered: CompileOptions = {
      jsx: true,
      remarkPlugins: [
        [
          remarkMarimo,
          {
            compile: async (request: MarimoPageRequest) => {
              const result = compiledPage(request);
              result.cells[0]!.index = 7;
              return result;
            },
          },
        ],
      ],
    };

    await expect(compile("```python marimo\nx = 1\n```", missing)).rejects.toThrow(
      "returned 0 cells for 1 marimo cells",
    );
    await expect(compile("```python marimo\nx = 1\n```", reordered)).rejects.toThrow(
      "returned cell 7 at position 0",
    );
  });

  it("reports authoring and compiler diagnostics with source context", async () => {
    const file = await compile("```python marimo typo=true\nx = 1\n```", {
      jsx: true,
      remarkPlugins: [
        [
          remarkMarimo,
          {
            compile: async (request: MarimoPageRequest) => ({
              ...compiledPage(request),
              diagnostics: [
                { severity: "warning", message: "Compiler warning", cellIndex: 0, line: 1 },
              ],
            }),
          },
        ],
      ],
    });

    expect(file.messages.map((message) => String(message))).toEqual([
      "1:1: Unknown marimo option: typo",
      "1:1: Compiler warning",
    ]);
  });
});

function compiler(inspect?: (request: MarimoPageRequest) => void): MarimoPageCompiler {
  return async (request) => {
    inspect?.(request);
    return compiledPage(request);
  };
}

function compiledPage(request: MarimoPageRequest): CompiledMarimoPage {
  return {
    protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
    app: {
      id: "marimo-test",
      runtimeCellCount: request.cells.length,
      assets: { links: [], moduleScripts: [] },
    },
    cells: request.cells.map((cell) => ({
      index: cell.index,
      html: "<marimo-island></marimo-island>",
      options: cell.options as MarimoCellOptions,
    })),
    diagnostics: [],
  };
}
