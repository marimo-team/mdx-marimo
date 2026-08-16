import { defineConfig } from "vite-plus";

const agentToolIgnorePatterns = [
  ".agent/**",
  ".agents/**",
  ".claude/**",
  ".codex/**",
  ".continue/**",
  ".cursor/**",
  ".gemini/**",
  ".opencode/**",
  ".pi/**",
  ".roo/**",
  ".windsurf/**",
] as const;

export default defineConfig({
  fmt: {
    ignorePatterns: [
      ...agentToolIgnorePatterns,
      "apps/docs/.next/**",
      "apps/docs/.output/**",
      "apps/docs/.source/**",
      "docs/tutorials/**/*.mdx",
      "apps/docs/src/routeTree.gen.ts",
      "examples/*/.astro/**",
      "examples/*/.docusaurus/**",
      "examples/*/.next/**",
      "examples/*/.nuxt/**",
      "examples/*/.output/**",
      "examples/*/build/**",
      "examples/*/dist/**",
      "packages/*/dist/**",
      "tools/oxlint/anti-slop/**",
    ],
  },
  lint: {
    ignorePatterns: [
      ...agentToolIgnorePatterns,
      "apps/docs/.output/**",
      "apps/docs/.source/**",
      "apps/docs/src/routeTree.gen.ts",
      "examples/*/.astro/**",
      "examples/*/.docusaurus/**",
      "examples/*/.next/**",
      "examples/*/.nuxt/**",
      "examples/*/.output/**",
      "examples/*/build/**",
      "examples/*/dist/**",
      "packages/*/dist/**",
      "tools/oxlint/anti-slop/**",
    ],
    jsPlugins: [{ name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" }],
    options: {
      typeAware: true,
    },
    rules: {
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/no-conditional-empty-object-spread": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-module-mocking": "error",
      "anti-slop/no-object-parameters": "error",
      "anti-slop/no-reflect-apply": "error",
      "anti-slop/no-reflect-get": "error",
      "anti-slop/no-runtime-typeof": "error",
      "anti-slop/no-structural-placeholder-names": "error",
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-unknown-returns": "error",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "error",
      "anti-slop/no-widen-then-assert": "error",
      "anti-slop/require-safety-comment-for-type-assertion": "error",
    },
    overrides: [
      {
        files: ["**/*.test.ts", "**/test/**"],
        rules: {
          "typescript/no-misused-spread": "off",
          "typescript/unbound-method": "off",
        },
      },
    ],
  },
});
