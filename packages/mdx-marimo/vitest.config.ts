import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: "@marimo-team/mdx-marimo/browser", replacement: source("./src/browser/index.ts") },
      {
        find: "@marimo-team/mdx-marimo/element/auto",
        replacement: source("./src/element/auto.ts"),
      },
      { find: "@marimo-team/mdx-marimo/element", replacement: source("./src/element/index.ts") },
      {
        find: "@marimo-team/mdx-marimo/extractor",
        replacement: source("./src/extractor/index.ts"),
      },
      { find: "@marimo-team/mdx-marimo/preset", replacement: source("./src/preset/index.ts") },
      {
        find: "@marimo-team/mdx-marimo/react",
        replacement: source("./src/adapters/react/index.ts"),
      },
      { find: "@marimo-team/mdx-marimo/remark", replacement: source("./src/remark/index.ts") },
      { find: "@marimo-team/mdx-marimo/schema", replacement: source("./src/schema.ts") },
      { find: "@marimo-team/mdx-marimo/vue", replacement: source("./src/adapters/vue/index.ts") },
      { find: /^@marimo-team\/mdx-marimo$/, replacement: source("./src/index.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
