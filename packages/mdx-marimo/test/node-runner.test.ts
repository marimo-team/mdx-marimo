import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

describe("compilerArgs", () => {
  it("uses a stable Python accepted by the page", () => {
    expect(
      compilerArgs(
        `
requires-python = ">=3.10"
dependencies = ["numpy", "marimo>=0.24"]
`,
        "/tmp/compile-page.py",
      ),
    ).toEqual([
      "run",
      "--python",
      "3.12",
      "--with",
      "numpy",
      "--with",
      "marimo>=0.24",
      "python",
      "/tmp/compile-page.py",
    ]);
  });

  it("honors a higher page-level Python requirement", () => {
    expect(compilerArgs('requires-python = ">=3.13"', "/tmp/compile-page.py").slice(0, 3)).toEqual([
      "run",
      "--python",
      "3.13",
    ]);
  });

  it("uses the stable default when page metadata is absent", () => {
    expect(compilerArgs(undefined, "/tmp/compile-page.py").slice(0, 3)).toEqual([
      "run",
      "--python",
      "3.12",
    ]);
  });
});
