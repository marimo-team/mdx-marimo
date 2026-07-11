import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("package metadata", () => {
  it("declares its publish and runtime dependency contracts", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      bundleDependencies?: string[];
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
      publishConfig?: { access?: string; registry?: string };
      repository?: { directory?: string; url?: string };
      sideEffects?: string[];
    };
    const bridgePackageJson = JSON.parse(
      readFileSync("../islands-bridge/package.json", "utf8"),
    ) as {
      private?: boolean;
    };

    expect(packageJson.dependencies?.react).toBeUndefined();
    expect(packageJson.dependencies?.["@marimo-team/islands-bridge"]).toBe("workspace:^");
    expect(packageJson.bundleDependencies).toContain("@marimo-team/islands-bridge");
    expect(bridgePackageJson.private).toBe(true);
    expect(packageJson.peerDependencies?.react).toBeDefined();
    expect(packageJson.peerDependenciesMeta?.react?.optional).toBe(true);
    expect(packageJson.publishConfig?.access).toBe("public");
    expect(packageJson.publishConfig?.registry).toBe("https://registry.npmjs.org/");
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+https://github.com/marimo-team/mdx-marimo.git",
      directory: "packages/mdx-marimo",
    });
    expect(packageJson.sideEffects).toContain("./dist/element/auto.js");
    expect(packageJson.exports?.["./react"]).toEqual({
      types: "./dist/adapters/react/index.d.ts",
      import: "./dist/adapters/react/index.js",
      default: "./dist/adapters/react/index.js",
    });
    expect(packageJson.exports?.["./node"]).toBeDefined();
    expect(packageJson.exports?.["./adapters/react"]).toBeUndefined();
  });
});
