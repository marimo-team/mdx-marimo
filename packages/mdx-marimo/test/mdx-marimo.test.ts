import { compile, type CompileOptions } from "@mdx-js/mdx";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { remarkMarimo } from "../src/remark";
import type { MarimoPageRequest, MarimoPageResult } from "../src/schema";

describe("remarkMarimo", () => {
  it("replaces marimo fences with MDX custom elements", async () => {
    let request: MarimoPageRequest | undefined;
    const file = await compile("```python marimo echo=true\nx = 1\n```", {
      jsx: true,
      remarkPlugins: [
        [
          remarkMarimo,
          {
            extract: async (payload: MarimoPageRequest): Promise<MarimoPageResult> => {
              request = payload;
              return {
                outputs: [
                  {
                    html: "<marimo-island></marimo-island>",
                    appId: "mdx-test",
                    cellIndex: 0,
                    runtimeCellCount: 1,
                    options: payload.cells[0]!.options,
                  },
                ],
              };
            },
          },
        ],
      ],
    });

    const compiled = String(file);
    expect(request?.cells).toHaveLength(1);
    expect(request?.cells[0]?.source).toBe("x = 1");
    expect(request?.cells[0]?.options).toMatchObject({
      language: "python",
      render: { source: true, output: true, include: true },
      execution: { enabled: true },
    });
    expect(compiled).toContain("<marimo-mdx-island ");
    expect(compiled).toContain('class="marimo-island-host"');
    expect(compiled).toContain("data-marimo-output");
    expect(compiled).not.toContain("<template");
    expect(compiled).toContain("&quot;appId&quot;:&quot;mdx-test&quot;");
  });

  it("imports a component output when configured", async () => {
    const file = await compile("```python marimo\nx = 1\n```", {
      jsx: true,
      remarkPlugins: [
        [
          remarkMarimo,
          {
            output: {
              type: "component",
              componentName: "_MarimoIsland",
              importName: "MarimoIsland",
              importSource: "marimo-runtime",
            },
            extract: async (payload: MarimoPageRequest): Promise<MarimoPageResult> => ({
              outputs: [
                {
                  html: "<marimo-island></marimo-island>",
                  appId: "component-test",
                  cellIndex: 0,
                  runtimeCellCount: 1,
                  options: payload.cells[0]!.options,
                },
              ],
            }),
          },
        ],
      ],
    });

    const compiled = String(file);
    expect(compiled).toContain('import {MarimoIsland as _MarimoIsland} from "marimo-runtime"');
    expect(compiled).toContain("<_MarimoIsland ");
    expect(compiled).toContain("output={{");
  });

  it("imports an element output client module when configured", async () => {
    const file = await compile("```python marimo\nx = 1\n```", {
      jsx: true,
      remarkPlugins: [
        [
          remarkMarimo,
          {
            output: {
              clientImportSource: "marimo-runtime/auto",
            },
            extract: async (payload: MarimoPageRequest): Promise<MarimoPageResult> => ({
              outputs: [
                {
                  html: "<marimo-island></marimo-island>",
                  appId: "element-import-test",
                  cellIndex: 0,
                  runtimeCellCount: 1,
                  options: payload.cells[0]!.options,
                },
              ],
            }),
          },
        ],
      ],
    });

    expect(String(file)).toContain('import "marimo-runtime/auto"');
  });

  it("keeps non-marimo Python fences as code blocks", async () => {
    const file = await compile("```python\nx = 1\n```", {
      jsx: true,
      remarkPlugins: [[remarkMarimo, { extract: async () => ({ outputs: [] }) }]],
    });

    const compiled = String(file);
    expect(compiled).toContain('<_components.pre><_components.code className="language-python"');
    expect(compiled).toContain("x = 1");
  });

  it("replaces nested marimo fences at their original parent", async () => {
    const file = await compile("> ```python marimo\n> x = 1\n> ```", {
      jsx: true,
      remarkPlugins: [
        [
          remarkMarimo,
          {
            extract: async (payload: MarimoPageRequest): Promise<MarimoPageResult> => ({
              outputs: [
                {
                  html: "<marimo-island></marimo-island>",
                  appId: "nested-test",
                  cellIndex: payload.cells[0]!.index,
                  runtimeCellCount: 1,
                  options: payload.cells[0]!.options,
                },
              ],
            }),
          },
        ],
      ],
    });

    const compiled = String(file);
    const blockquote = compiled.match(
      /<_components\.blockquote>([\s\S]*?)<\/_components\.blockquote>/,
    )?.[1];
    expect(blockquote).toContain("<marimo-mdx-island ");
  });

  it("removes config fences and passes page metadata to extraction", async () => {
    let request: MarimoPageRequest | undefined;
    await compile(
      [
        "```marimo-config",
        'dependencies = ["numpy"]',
        "```",
        "",
        "```python marimo",
        "1",
        "```",
      ].join("\n"),
      {
        jsx: true,
        remarkPlugins: [
          [
            remarkMarimo,
            {
              extract: async (payload: MarimoPageRequest): Promise<MarimoPageResult> => {
                request = payload;
                return {
                  outputs: [
                    {
                      html: "<marimo-island></marimo-island>",
                      appId: "metadata-test",
                      cellIndex: 0,
                      runtimeCellCount: 1,
                      options: payload.cells[0]!.options,
                    },
                  ],
                };
              },
            },
          ],
        ],
      },
    );

    expect(request?.metadata.pyproject).toBe('dependencies = ["numpy"]');
  });

  it("passes a public relative filename to extraction", async () => {
    let request: MarimoPageRequest | undefined;
    await compile(
      {
        value: "```python marimo\n__file__\n```",
        path: join(process.cwd(), "apps", "docs", "page.mdx"),
      },
      {
        jsx: true,
        remarkPlugins: [
          [
            remarkMarimo,
            {
              cwd: process.cwd(),
              extract: async (payload: MarimoPageRequest): Promise<MarimoPageResult> => {
                request = payload;
                return {
                  outputs: [
                    {
                      html: "<marimo-island></marimo-island>",
                      appId: "filename-test",
                      cellIndex: 0,
                      runtimeCellCount: 1,
                      options: payload.cells[0]!.options,
                    },
                  ],
                };
              },
            },
          ],
        ],
      },
    );

    expect(request?.filename).toBe(join("apps", "docs", "page.mdx"));
  });

  it("uses a configured identity function", async () => {
    let request: MarimoPageRequest | undefined;
    await compile(
      { value: "```python marimo\n1\n```", path: "/content/page.mdx" },
      {
        jsx: true,
        remarkPlugins: [
          [
            remarkMarimo,
            {
              identity: ({ filename }: { filename: string; filePath: string | undefined }) =>
                `page:${filename}`,
              extract: async (payload: MarimoPageRequest): Promise<MarimoPageResult> => {
                request = payload;
                return {
                  outputs: [
                    {
                      html: "",
                      appId: "identity-test",
                      cellIndex: 0,
                      runtimeCellCount: 1,
                      options: payload.cells[0]!.options,
                    },
                  ],
                };
              },
            },
          ],
        ],
      },
    );

    expect(request?.identity).toBe("page:page.mdx");
  });

  it("requires an extractor for marimo fences", async () => {
    await expect(
      compile("```python marimo\nx = 1\n```", {
        jsx: true,
        remarkPlugins: [remarkMarimo],
      }),
    ).rejects.toThrow("requires an extract function");
  });

  it("checks extractor output count", async () => {
    const options: CompileOptions = {
      jsx: true,
      remarkPlugins: [[remarkMarimo, { extract: async () => ({ outputs: [] }) }]],
    };
    await expect(compile("```python marimo\nx = 1\n```", options)).rejects.toThrow(
      "returned 0 outputs for 1 marimo cells",
    );
  });

  it("reports fence option diagnostics with source lines", async () => {
    const file = await compile("```python marimo typo=true\nx = 1\n```", {
      jsx: true,
      remarkPlugins: [
        [
          remarkMarimo,
          {
            extract: async (payload: MarimoPageRequest): Promise<MarimoPageResult> => ({
              outputs: [
                {
                  html: "",
                  appId: "diagnostic-test",
                  cellIndex: 0,
                  runtimeCellCount: 1,
                  options: payload.cells[0]!.options,
                },
              ],
            }),
          },
        ],
      ],
    });

    expect(file.messages.map((message) => String(message))).toEqual([
      "1:1: Unknown marimo option: typo",
    ]);
  });
});
