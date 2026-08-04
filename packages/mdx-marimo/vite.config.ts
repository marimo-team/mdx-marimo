import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const bridgeEntries = {
  "bridge/browser/index": "../islands-bridge/src/browser/index.ts",
  "bridge/element/index": "../islands-bridge/src/element/index.ts",
  "bridge/protocol/index": "../islands-bridge/src/protocol/index.ts",
};

// Deno follows .js specifiers inside declaration files without substituting a
// neighboring .d.ts file. Emit each public entry as one self-contained type graph.
const bridgeTypeBuilds = Object.entries(bridgeEntries).map(([entry, path]) => ({
  name: `mdx-marimo-${entry.replaceAll("/", "-")}-types`,
  entry: { [entry]: path },
  clean: false,
  dts: {
    emitDtsOnly: true,
    sourcemap: true,
  },
  format: ["esm" as const],
  platform: "neutral" as const,
  target: "es2022",
}));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@marimo-team/mdx-marimo/bridge/browser",
        replacement: source("./src/bridge/browser.ts"),
      },
      {
        find: "@marimo-team/mdx-marimo/bridge/element",
        replacement: source("./src/bridge/element.ts"),
      },
      {
        find: "@marimo-team/mdx-marimo/bridge/protocol",
        replacement: source("./src/bridge/protocol.ts"),
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
        find: "@marimo-team/mdx-marimo/vitepress",
        replacement: source("./src/adapters/vitepress/index.ts"),
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
        "adapters/vitepress/index": "src/adapters/vitepress/index.ts",
        "element/index": "src/element/index.ts",
        "node/index": "src/node/index.ts",
        "remark/index": "src/remark/index.ts",
      },
      copy: [{ from: "../islands-compiler/compiler.py", to: "dist/node" }],
      deps: {
        neverBundle: [/^node:/, /^@marimo-team\/mdx-marimo\/.+$/],
      },
      dts: {
        sourcemap: true,
      },
      format: ["esm"],
      platform: "neutral",
      publint: {
        level: "error",
      },
      sourcemap: true,
      target: "es2022",
      attw: {
        excludeEntrypoints: ["./bridge/styles.css", "./styles.css"],
        level: "error",
        profile: "esm-only",
      },
    },
    {
      name: "mdx-marimo-bridge",
      entry: bridgeEntries,
      clean: false,
      dts: false,
      format: ["esm"],
      platform: "neutral",
      sourcemap: true,
      target: "es2022",
    },
    {
      name: "mdx-marimo-styles",
      entry: ["../islands-bridge/src/styles.css"],
      clean: false,
      css: {
        fileName: "styles.css",
      },
      dts: false,
    },
    ...bridgeTypeBuilds,
    {
      name: "mdx-marimo-element-auto",
      entry: {
        "element/auto": "src/element/auto.ts",
      },
      deps: {
        alwaysBundle: [/^@marimo-team\/mdx-marimo\/bridge(?:\/.*)?$/],
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
