import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@marimo-team/islands-bridge/browser",
        replacement: source("./src/browser/index.ts"),
      },
      {
        find: "@marimo-team/islands-bridge/element",
        replacement: source("./src/element/index.ts"),
      },
      {
        find: "@marimo-team/islands-bridge/protocol",
        replacement: source("./src/protocol/index.ts"),
      },
      { find: /^@marimo-team\/islands-bridge$/, replacement: source("./src/index.ts") },
    ],
  },
  pack: {
    entry: {
      index: "src/index.ts",
      "browser/index": "src/browser/index.ts",
      "element/index": "src/element/index.ts",
      "protocol/index": "src/protocol/index.ts",
    },
    copy: [
      { from: "src/styles.css", to: "dist" },
      { from: "src/styling/*.css", to: "dist/styling" },
    ],
    dts: {
      sourcemap: true,
    },
    format: ["esm"],
    platform: "neutral",
    sourcemap: true,
    target: "es2022",
  },
  run: {
    tasks: {
      build: {
        command: "vp pack",
      },
      typecheck: {
        command: ["tsc -p tsconfig.json --noEmit", "tsc -p tsconfig.test.json --noEmit"],
      },
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
