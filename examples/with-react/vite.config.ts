import mdx from "@mdx-js/rollup";
import { remarkMarimo } from "@marimo-team/mdx-marimo/remark";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      enforce: "pre",
      ...mdx({
        jsxImportSource: "react",
        providerImportSource: "@mdx-js/react",
        remarkPlugins: [remarkMarimo],
      }),
    },
    react(),
  ],
});
