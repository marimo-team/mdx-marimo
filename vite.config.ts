import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: [
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
    options: {
      typeAware: true,
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
