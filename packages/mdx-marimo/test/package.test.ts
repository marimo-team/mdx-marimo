import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("package metadata", () => {
  it("publishes the host adapters and bridge entry points", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      exports?: Record<string, unknown>;
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
      sideEffects?: string[];
    };

    expect(packageJson.peerDependencies?.react).toBeDefined();
    expect(packageJson.peerDependenciesMeta?.react?.optional).toBe(true);
    expect(packageJson.sideEffects).toEqual(
      expect.arrayContaining(["./dist/element/auto.js", "./dist/styles.css"]),
    );
    for (const subpath of [
      ".",
      "./remark",
      "./element",
      "./element/auto",
      "./node",
      "./react",
      "./vitepress",
      "./bridge/browser",
      "./bridge/element",
      "./bridge/protocol",
    ]) {
      expect(packageJson.exports?.[subpath]).toBeDefined();
    }
    expect(packageJson.exports?.["./bridge/styles.css"]).toBe("./dist/styles.css");
  });
});
