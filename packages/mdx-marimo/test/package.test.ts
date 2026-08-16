import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

const publishedSubpaths = [
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
] as const;

type PublishedSubpath = (typeof publishedSubpaths)[number] | "./bridge/styles.css";

type PackageExport =
  | string
  | {
      types: string;
      import: string;
      default: string;
    };

type PackageManifest = {
  exports?: Partial<Record<PublishedSubpath, PackageExport>>;
  peerDependencies?: Partial<Record<"react", string>>;
  peerDependenciesMeta?: Partial<Record<"react", { optional?: boolean }>>;
  sideEffects?: string[];
};

describe("package metadata", () => {
  it("publishes the host adapters and bridge entry points", () => {
    // SAFETY: This checked-in file is the package manifest exercised by the test.
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as PackageManifest;

    expect(packageJson.peerDependencies?.react).toBeDefined();
    expect(packageJson.peerDependenciesMeta?.react?.optional).toBe(true);
    expect(packageJson.sideEffects).toEqual(
      expect.arrayContaining(["./dist/element/auto.js", "./dist/styles.css"]),
    );
    for (const subpath of publishedSubpaths) {
      expect(packageJson.exports?.[subpath]).toBeDefined();
    }
    expect(packageJson.exports?.["./bridge/styles.css"]).toBe("./dist/styles.css");
  });
});
