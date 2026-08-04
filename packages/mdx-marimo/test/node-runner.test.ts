import { afterEach, describe, expect, it } from "vite-plus/test";
import { compilerArgs, resolveUvCommand } from "../src/node/uv";

const originalUvCommand = process.env.MDX_MARIMO_UV;

afterEach(() => {
  if (originalUvCommand === undefined) {
    delete process.env.MDX_MARIMO_UV;
  } else {
    process.env.MDX_MARIMO_UV = originalUvCommand;
  }
});

describe("resolveUvCommand", () => {
  it("resolves explicit and process-wide commands", () => {
    expect(resolveUvCommand({ uvCommand: "/opt/bin/uv" })).toBe("/opt/bin/uv");
    process.env.MDX_MARIMO_UV = "/env/bin/uv";
    expect(resolveUvCommand({ cwd: process.cwd() })).toBe("/env/bin/uv");
  });
});

describe("compilerArgs", () => {
  it("projects page dependencies into the compiler environment", () => {
    const args = compilerArgs(
      `
requires-python = ">=3.10"
dependencies = ["numpy", "marimo>=0.24"]
`,
      "/tmp/compile-page.py",
    );

    expect(valuesAfter(args, "--with")).toEqual(["numpy", "marimo>=0.24"]);
    expect(args.at(-1)).toBe("/tmp/compile-page.py");
  });

  it("reads dependencies and Python from wrapped script metadata", () => {
    const args = compilerArgs(
      '# /// script\n#requires-python = ">=3.13"\n# dependencies = ["numpy"]\n# ///',
      "/tmp/compile-page.py",
    );

    expect(valueAfter(args, "--python")).toBe("3.13");
    expect(valuesAfter(args, "--with")).toEqual(["marimo>=0.23.15", "numpy"]);
  });

  it.each([
    [undefined, "3.12"],
    ['requires-python = ">=3.10"', "3.12"],
    ['requires-python = ">=3.13"', "3.13"],
  ])("selects a Python version accepted by %s", (pyproject, expected) => {
    const args = compilerArgs(pyproject, "/tmp/compile-page.py");

    expect(valueAfter(args, "--python")).toBe(expected);
  });
});

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function valuesAfter(args: string[], flag: string): string[] {
  return args.flatMap((value, index) => (value === flag ? [args[index + 1]!] : []));
}
