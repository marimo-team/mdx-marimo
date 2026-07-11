import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  MARIMO_PAGE_PROTOCOL_VERSION,
  type MarimoPageRequest,
} from "@marimo-team/islands-bridge/protocol";
import { compileMarimoPage } from "../src/node";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("compileMarimoPage", () => {
  it("writes compilation results to the Node tool cache by default", async () => {
    const cwd = tempDir();

    await compileMarimoPage(pageRequest(), {
      cwd,
      uvCommand: fakeUv(cwd),
    });

    expect(existsSync(join(cwd, "node_modules", ".cache", "@marimo-team", "mdx-marimo"))).toBe(
      true,
    );
  });

  it("accepts a disabled compilation cache", async () => {
    const cwd = tempDir();

    await compileMarimoPage(pageRequest(), {
      cacheDir: false,
      cwd,
      uvCommand: fakeUv(cwd),
    });

    expect(existsSync(join(cwd, "node_modules", ".cache", "@marimo-team", "mdx-marimo"))).toBe(
      false,
    );
  });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "mdx-marimo-compile-"));
  tempDirs.push(dir);
  return dir;
}

function fakeUv(cwd: string): string {
  const path = join(cwd, process.platform === "win32" ? "fake-uv.cmd" : "fake-uv");
  writeFileSync(
    path,
    `#!/usr/bin/env node
process.stdin.resume();
process.stdin.on("end", () => {
  process.stdout.write(JSON.stringify({
    protocolVersion: 1,
    app: null,
    cells: [],
    diagnostics: [],
  }));
});
`,
  );
  chmodSync(path, 0o755);
  return path;
}

function pageRequest(): MarimoPageRequest {
  return {
    protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
    filename: "page.mdx",
    identity: "page.mdx",
    metadata: {},
    cells: [],
  };
}
