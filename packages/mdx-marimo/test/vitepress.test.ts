import {
  MARIMO_PAGE_PROTOCOL_VERSION,
  type CompiledMarimoPage,
  type MarimoCellOptions,
  type MarimoPageCompiler,
  type MarimoPageRequest,
} from "@marimo-team/islands-bridge/protocol";
import { Buffer } from "node:buffer";
import { describe, expect, it } from "vite-plus/test";
import { marimoVitePress } from "../src/adapters/vitepress";

describe("marimoVitePress", () => {
  it("compiles one page and projects visible cells into the VitePress source", async () => {
    const requests: MarimoPageRequest[] = [];
    const plugin = marimoVitePress({
      cwd: "/project",
      compile: compiler((request) => requests.push(request)),
    });
    const source = [
      "# Live output",
      "",
      "```marimo-config",
      'dependencies = ["numpy"]',
      "```",
      "",
      "```python marimo output=false",
      "import marimo as mo",
      "```",
      "",
      "```python marimo",
      'slider = mo.ui.slider(1, 10, label="Rows")',
      "slider",
      "```",
      "",
      "> ```python.marimo",
      '> mo.md(f"Rows: {slider.value}")',
      "> ```",
      "",
      "```python",
      'print("ordinary")',
      "```",
    ].join("\n");

    const result = await transform(plugin, source, "/project/docs/page.md");

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      filename: "docs/page.md",
      identity: "docs/page.md",
      metadata: { pyproject: 'dependencies = ["numpy"]' },
      cells: [
        {
          index: 0,
          source: "import marimo as mo",
          options: { render: { output: false } },
          startLine: 7,
          endLine: 9,
        },
        {
          index: 1,
          source: 'slider = mo.ui.slider(1, 10, label="Rows")\nslider',
        },
        {
          index: 2,
          source: 'mo.md(f"Rows: {slider.value}")',
        },
      ],
    });
    expect(result).not.toContain("marimo-config");
    expect(result).not.toContain("python marimo");
    expect(result).toContain('```python\nprint("ordinary")\n```');
    expect(result).toContain("> <marimo-mdx-island ");

    const payloads = Array.from(result.matchAll(/data-marimo-payload="([^"]+)"/g));
    expect(payloads).toHaveLength(2);
    const firstPayload = payloads[0]?.[1];
    expect(firstPayload).toBeDefined();
    expect(decodePayload(firstPayload!)).toMatchObject({
      protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
      app: { id: "marimo-test", runtimeCellCount: 3 },
      cell: { index: 1 },
    });
    expect(result).toContain('data-marimo-app-id="marimo-test"');
    expect(result).toContain('data-marimo-theme-mode="auto"');
  });

  it("reports authoring and compiler diagnostics with source context", async () => {
    const warnings: string[] = [];
    const plugin = marimoVitePress({
      cwd: "/project",
      compile: async (request) => ({
        ...compiledPage(request),
        diagnostics: [
          { severity: "warning", message: "Compiler warning", cellIndex: 0 },
          { severity: "error", message: "Compiler error", cellIndex: 0 },
        ],
      }),
    });

    await expect(
      transform(
        plugin,
        "Intro\n\n```python marimo typo=true\nvalue = 1\n```",
        "/project/docs/page.md",
        warnings,
      ),
    ).rejects.toThrow("docs/page.md:3: Compiler error");
    expect(warnings).toEqual([
      "docs/page.md:3: Unknown marimo option: typo",
      "docs/page.md:3: Compiler warning",
    ]);
  });

  it("caches successful compilations and retries failed compilations", async () => {
    let calls = 0;
    const plugin = marimoVitePress({
      compile: async (request) => {
        calls += 1;
        if (calls === 1) throw new Error("temporary compiler failure");
        return compiledPage(request);
      },
    });
    const source = "```python marimo\nvalue = 1\n```";

    await expect(transform(plugin, source, "/project/page.md")).rejects.toThrow(
      "temporary compiler failure",
    );
    await transform(plugin, source, "/project/page.md");
    await transform(plugin, source, "/project/page.md?import");

    expect(calls).toBe(2);
  });

  it("leaves unrelated Markdown modules unchanged", async () => {
    const plugin = marimoVitePress({ compile: compiler() });

    await expect(
      transformResult(plugin, "```python\nvalue = 1\n```", "/project/page.md"),
    ).resolves.toBeNull();
    await expect(
      transformResult(plugin, "```python marimo\nvalue = 1\n```", "/project/page.mdx"),
    ).resolves.toBeNull();
  });
});

function compiler(inspect: (request: MarimoPageRequest) => void = () => {}): MarimoPageCompiler {
  return (request) => {
    inspect(request);
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
      html: cell.options.render?.output === false ? "" : `<p>cell ${cell.index}</p>`,
      options: cell.options as MarimoCellOptions,
    })),
    diagnostics: [],
  };
}

async function transform(
  plugin: ReturnType<typeof marimoVitePress>,
  source: string,
  id: string,
  warnings: string[] = [],
): Promise<string> {
  const result = await transformResult(plugin, source, id, warnings);
  if (!result) throw new Error("Expected marimo plugin to transform the page");
  return result.code;
}

async function transformResult(
  plugin: ReturnType<typeof marimoVitePress>,
  source: string,
  id: string,
  warnings: string[] = [],
) {
  return plugin.transform.call(
    {
      warn(message: string) {
        warnings.push(message);
      },
    },
    source,
    id,
  );
}

function decodePayload(encoded: string): unknown {
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
}
