import { describe, expect, it } from "vitest";
import { marimoVueMdx } from "../src/adapters/vue";
import type { MarimoPageRequest, MarimoPageResult } from "../src/schema";

describe("marimoVueMdx", () => {
  it("compiles MDX with Vue defaults and marimo islands", async () => {
    const plugin = marimoVueMdx({
      extract: async (payload: MarimoPageRequest): Promise<MarimoPageResult> => ({
        outputs: [
          {
            html: "<marimo-island></marimo-island>",
            appId: "vue-adapter-test",
            cellIndex: 0,
            runtimeCellCount: 1,
            options: payload.cells[0]!.options,
          },
        ],
      }),
    }) as unknown as {
      config?: (config: unknown, env: { mode: string }) => void;
      transform: (value: string, id: string) => Promise<{ code: string } | undefined>;
    };

    plugin.config?.({}, { mode: "production" });
    const result = await plugin.transform("```python marimo\nx = 1\n```", "/tmp/page.mdx");

    expect(result?.code).toContain('from "vue/jsx-runtime"');
    expect(result?.code).toContain('from "@mdx-js/vue"');
    expect(result?.code).toContain("marimo-mdx-island");
    expect(result?.code).toContain("data-marimo-output");
  });
});
