import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { extractorArgs, resolveUvCommand } from "../src/extractor/uv";

const originalUvCommand = process.env.MDX_MARIMO_UV;

afterEach(() => {
  if (originalUvCommand === undefined) {
    delete process.env.MDX_MARIMO_UV;
  } else {
    process.env.MDX_MARIMO_UV = originalUvCommand;
  }
});

describe("resolveUvCommand", () => {
  it("uses the configured command first", () => {
    expect(resolveUvCommand({ uvCommand: "/opt/bin/uv" })).toBe("/opt/bin/uv");
  });

  it("uses the environment command before discovered commands", () => {
    process.env.MDX_MARIMO_UV = "/env/bin/uv";

    expect(resolveUvCommand({ cwd: process.cwd() })).toBe("/env/bin/uv");
  });

  it("uses the workspace uv binary before the packaged fallback", () => {
    delete process.env.MDX_MARIMO_UV;
    const cwd = mkdtempSync(join(tmpdir(), "mdx-marimo-uv-"));
    const binDir = join(cwd, "node_modules", ".bin");
    const uvBin = join(binDir, process.platform === "win32" ? "uv.cmd" : "uv");

    try {
      mkdirSync(binDir, { recursive: true });
      writeFileSync(uvBin, "");

      expect(resolveUvCommand({ cwd })).toBe(uvBin);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("falls back to the package uv binary", () => {
    delete process.env.MDX_MARIMO_UV;
    const cwd = mkdtempSync(join(tmpdir(), "mdx-marimo-uv-"));

    try {
      expect(resolveUvCommand({ cwd })).toMatch(/@manzt[/\\]uv[/\\]bin\.cjs$/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("extractorArgs", () => {
  it("uses the extractor script with marimo and Python requirements", () => {
    expect(
      extractorArgs(
        `
requires-python = ">=3.12"
dependencies = ["numpy", "marimo>=0.24"]
`,
        "/tmp/extract-marimo.py",
      ),
    ).toEqual([
      "run",
      "--python",
      "3.12",
      "--with",
      "numpy",
      "--with",
      "marimo>=0.24",
      "--with",
      'tomli>=2; python_version < "3.11"',
      "python",
      "/tmp/extract-marimo.py",
    ]);
  });
});
