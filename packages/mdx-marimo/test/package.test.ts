import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("package metadata", () => {
  it("publishes the bridge through mdx-marimo subpaths", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      bundleDependencies?: string[];
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
      sideEffects?: string[];
    };
    const bridgePackageJson = JSON.parse(
      readFileSync("../islands-bridge/package.json", "utf8"),
    ) as {
      private?: boolean;
    };

    expect(packageJson.dependencies?.react).toBeUndefined();
    expect(packageJson.dependencies?.["@marimo-team/islands-bridge"]).toBeUndefined();
    expect(packageJson.bundleDependencies).toBeUndefined();
    expect(packageJson.devDependencies?.["@marimo-team/islands-bridge"]).toBe("workspace:*");
    expect(bridgePackageJson.private).toBe(true);
    expect(packageJson.peerDependencies?.react).toBeDefined();
    expect(packageJson.peerDependenciesMeta?.react?.optional).toBe(true);
    expect(packageJson.sideEffects).toContain("./dist/element/auto.js");
    expect(packageJson.sideEffects).toContain("./dist/bridge/styles.css");
    expect(packageJson.exports?.["./react"]).toEqual({
      types: "./dist/adapters/react/index.d.ts",
      import: "./dist/adapters/react/index.js",
      default: "./dist/adapters/react/index.js",
    });
    expect(packageJson.exports?.["./vitepress"]).toEqual({
      types: "./dist/adapters/vitepress/index.d.ts",
      import: "./dist/adapters/vitepress/index.js",
      default: "./dist/adapters/vitepress/index.js",
    });
    expect(packageJson.exports?.["./node"]).toBeDefined();
    expect(packageJson.exports?.["./bridge"]).toBeDefined();
    expect(packageJson.exports?.["./bridge/browser"]).toBeDefined();
    expect(packageJson.exports?.["./bridge/element"]).toBeDefined();
    expect(packageJson.exports?.["./bridge/protocol"]).toBeDefined();
    expect(packageJson.exports?.["./bridge/styles.css"]).toBe("./dist/bridge/styles.css");
  });
});
