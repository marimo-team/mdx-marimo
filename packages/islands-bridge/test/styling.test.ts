import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const publicTokens = [
  "--marimo-island-background",
  "--marimo-island-foreground",
  "--marimo-island-surface",
  "--marimo-island-muted-surface",
  "--marimo-island-muted-foreground",
  "--marimo-island-border",
  "--marimo-island-accent",
  "--marimo-island-accent-foreground",
  "--marimo-island-focus-ring",
  "--marimo-island-code-background",
  "--marimo-island-code-foreground",
  "--marimo-island-error-background",
  "--marimo-island-error-border",
  "--marimo-island-error-foreground",
  "--marimo-island-error-accent",
  "--marimo-island-radius",
  "--marimo-island-margin-block",
];
const stylingFiles = [
  join("src", "styles.css"),
  join("src", "styling", "tokens.css"),
  join("src", "styling", "layout.css"),
  join("src", "styling", "compatibility.css"),
  join("src", "styling", "shadow-theme.ts"),
];

function readStylingSources(): string {
  return stylingFiles.map((file) => readFileSync(file, "utf8")).join("\n");
}

describe("island styling contract", () => {
  it("documents every public island token", () => {
    const readme = readFileSync("README.md", "utf8");

    for (const token of publicTokens) {
      expect(readme).toContain(token);
    }
  });

  it("consumes the public island tokens from package styles", () => {
    const styles = readStylingSources();

    expect(styles).toContain(".marimo-island-host");

    const consumedTokens = [...new Set(styles.match(/--marimo-island-[\w-]+/g) ?? [])].sort();
    expect(consumedTokens).toEqual([...publicTokens].sort());
  });

  it("uses split styling sources for tokens, layout, and compatibility", () => {
    const styles = readFileSync("src/styles.css", "utf8");

    expect(styles).toContain('@import "./styling/tokens.css"');
    expect(styles).toContain('@import "./styling/layout.css"');
    expect(styles).toContain('@import "./styling/compatibility.css"');
  });

  it("uses one host class without publishing-host selectors", () => {
    const browserRuntime = readFileSync(join("src", "browser", "island.ts"), "utf8");

    expect(browserRuntime).toContain('"marimo-island-host"');
    expect(browserRuntime).toContain("marimoHost");
    expect(readStylingSources()).not.toContain("mdx");
  });
});
