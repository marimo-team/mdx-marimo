import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@marimo-team/islands-bridge/browser",
        replacement: source("../islands-bridge/src/browser/index.ts"),
      },
      {
        find: "@marimo-team/islands-bridge/element",
        replacement: source("../islands-bridge/src/element/index.ts"),
      },
      {
        find: "@marimo-team/islands-bridge/protocol",
        replacement: source("../islands-bridge/src/protocol/index.ts"),
      },
      {
        find: "@marimo-team/mdx-marimo/element/auto",
        replacement: source("./src/element/auto.ts"),
      },
      {
        find: "@marimo-team/mdx-marimo/element",
        replacement: source("./src/element/index.ts"),
      },
      {
        find: "@marimo-team/mdx-marimo/node",
        replacement: source("./src/node/index.ts"),
      },
      {
        find: "@marimo-team/mdx-marimo/react",
        replacement: source("./src/adapters/react/index.ts"),
      },
      {
        find: "@marimo-team/mdx-marimo/remark",
        replacement: source("./src/remark/index.ts"),
      },
      {
        find: /^@marimo-team\/islands-bridge$/,
        replacement: source("../islands-bridge/src/index.ts"),
      },
      { find: /^@marimo-team\/mdx-marimo$/, replacement: source("./src/index.ts") },
    ],
  },
  pack: [
    {
      name: "mdx-marimo",
      entry: {
        index: "src/index.ts",
        "adapters/react/index": "src/adapters/react/index.ts",
        "element/index": "src/element/index.ts",
        "node/index": "src/node/index.ts",
        "remark/index": "src/remark/index.ts",
      },
      copy: [
        { from: "src/node/compile-page.py", to: "dist/node" },
        { from: "src/styles.css", to: "dist" },
      ],
      deps: {
        neverBundle: [
          /^node:/,
          /^@marimo-team\/islands-bridge(?:\/.*)?$/,
          /^@marimo-team\/mdx-marimo\/.+$/,
        ],
      },
      dts: {
        sourcemap: true,
      },
      format: ["esm"],
      platform: "neutral",
      sourcemap: true,
      target: "es2022",
    },
    {
      name: "mdx-marimo-element-auto",
      entry: {
        "element/auto": "src/element/auto.ts",
      },
      deps: {
        alwaysBundle: [/^@marimo-team\/islands-bridge(?:\/.*)?$/],
      },
      dts: {
        sourcemap: false,
      },
      format: ["esm"],
      platform: "browser",
      sourcemap: false,
      target: "es2022",
    },
  ],
  run: {
    tasks: {
      build: {
        command: "vp pack",
        dependsOn: [{ task: "build", from: "dependencies" }],
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
