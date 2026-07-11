import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

describe("package boundary", () => {
  it("defines framework-neutral protocol and browser entry points", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      description?: string;
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
      name?: string;
      private?: boolean;
      repository?: { directory?: string; url?: string };
    };

    expect(packageJson.name).toBe("@marimo-team/islands-bridge");
    expect(packageJson.description).toBe(
      "Host-neutral page protocol and browser bridge for publishing reactive marimo islands.",
    );
    expect(packageJson.private).toBe(true);
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+https://github.com/marimo-team/mdx-marimo.git",
      directory: "packages/islands-bridge",
    });
    expect(packageJson.dependencies).toBeUndefined();
    expect(packageJson.exports?.["./protocol"]).toBeDefined();
    expect(packageJson.exports?.["./browser"]).toBeDefined();
    expect(packageJson.exports?.["./element"]).toBeDefined();
    expect(packageJson.exports?.["./styles.css"]).toBe("./dist/styles.css");
  });
});
