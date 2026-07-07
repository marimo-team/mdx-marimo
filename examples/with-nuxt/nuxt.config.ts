import { marimoVueMdx } from "@marimo-team/mdx-marimo/vue";

export default defineNuxtConfig({
  compatibilityDate: "2026-07-07",
  css: ["@marimo-team/mdx-marimo/styles.css"],
  vite: {
    plugins: [marimoVueMdx()],
  },
});
