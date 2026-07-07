import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("package metadata", () => {
  it("declares React as an optional peer for the adapter", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
      sideEffects?: string[];
    };

    expect(packageJson.dependencies?.react).toBeUndefined();
    expect(packageJson.dependencies?.vue).toBeUndefined();
    expect(packageJson.dependencies?.["@mdx-js/vue"]).toBeUndefined();
    expect(packageJson.peerDependencies?.react).toBeDefined();
    expect(packageJson.peerDependencies?.vue).toBeDefined();
    expect(packageJson.peerDependencies?.["@mdx-js/vue"]).toBeDefined();
    expect(packageJson.peerDependenciesMeta?.react?.optional).toBe(true);
    expect(packageJson.peerDependenciesMeta?.vue?.optional).toBe(true);
    expect(packageJson.peerDependenciesMeta?.["@mdx-js/vue"]?.optional).toBe(true);
    expect(packageJson.sideEffects).toContain("./dist/element/auto.js");
    const reactExport = packageJson.exports?.["./react"] as Record<string, string> | undefined;
    expect(reactExport?.browser).toBe("./dist/adapters/react/browser.js");
    expect(packageJson.exports?.["./vue"]).toBeDefined();
    expect(packageJson.exports?.["./adapters/react"]).toBeUndefined();
    expect(packageJson.exports?.["./adapters/vue"]).toBeUndefined();
  });
});
