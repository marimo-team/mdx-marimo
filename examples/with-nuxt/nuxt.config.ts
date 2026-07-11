import mdx from "@mdx-js/rollup";
import { remarkMarimo } from "@marimo-team/mdx-marimo/remark";

export default defineNuxtConfig({
  compatibilityDate: "2026-07-07",
  css: ["../site.css", "@marimo-team/mdx-marimo/styles.css"],
  vite: {
    plugins: [
      {
        enforce: "pre",
        ...mdx({
          jsxImportSource: "vue",
          providerImportSource: "@mdx-js/vue",
          remarkPlugins: [remarkMarimo],
        }),
      },
    ],
  },
});
