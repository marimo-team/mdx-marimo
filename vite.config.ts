import { defineConfig } from "vite-plus";

import { antiSlopIgnorePatterns, antiSlopRules } from "./tools/oxlint/anti-slop/preset.ts";

export default defineConfig({
  fmt: {
    ignorePatterns: [
      ...antiSlopIgnorePatterns,
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
    ],
  },
  lint: {
    ignorePatterns: [
      ...antiSlopIgnorePatterns,
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
    ],
    jsPlugins: [{ name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" }],
    options: {
      denyWarnings: true,
      reportUnusedDisableDirectives: "error",
      typeAware: true,
    },
    rules: {
      ...antiSlopRules,
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
