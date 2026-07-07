import mdx from "@mdx-js/rollup";
import { marimoReactMdx } from "@marimo-team/mdx-marimo/react";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    mdx({
      providerImportSource: "@mdx-js/react",
      remarkPlugins: [marimoReactMdx()],
    }),
    react(),
  ],
});
