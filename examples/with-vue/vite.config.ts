import mdx from "@mdx-js/rollup";
import { remarkMarimo } from "@marimo-team/mdx-marimo/remark";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      enforce: "pre",
      ...mdx({
        jsxImportSource: "vue",
        providerImportSource: "@mdx-js/vue",
        remarkPlugins: [remarkMarimo],
      }),
    },
    vue(),
  ],
});
