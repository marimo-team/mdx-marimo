import { describe, expect, it } from "vitest";
import { marimoReactMdx } from "../src/adapters/react";
import { marimoMdx } from "../src/preset";
import { remarkMarimo } from "../src/remark";

describe("marimoMdx", () => {
  it("returns a remark plugin tuple with package defaults", () => {
    const [plugin, options] = marimoMdx();

    expect(plugin).toBe(remarkMarimo);
    expect(options.cwd).toBe(process.cwd());
    expect(options.output).toEqual({ type: "element" });
    expect(typeof options.extract).toBe("function");
  });

  it("uses a configured cwd", () => {
    const [, options] = marimoMdx({ cwd: "/tmp/site" });

    expect(options.cwd).toBe("/tmp/site");
  });

  it("accepts an explicit component output", () => {
    const [, options] = marimoMdx({
      output: { type: "component", importSource: "marimo-runtime" },
    });

    expect(options.output).toEqual({ type: "component", importSource: "marimo-runtime" });
  });

  it("uses the React adapter import from the React preset", () => {
    const [, options] = marimoReactMdx();

    expect(options.output).toEqual({
      type: "component",
      componentName: "MarimoIsland",
      importSource: "@marimo-team/mdx-marimo/react",
    });
  });

  it("uses a configured extractor", async () => {
    const extract = async () => ({ outputs: [] });
    const [, options] = marimoMdx({ extract });

    await expect(
      options.extract({ filename: "", identity: "", metadata: {}, diagnostics: [], cells: [] }),
    ).resolves.toEqual({ outputs: [] });
  });
});
