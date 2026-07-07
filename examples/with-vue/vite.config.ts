import { marimoVueMdx } from "@marimo-team/mdx-marimo/vue";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [marimoVueMdx(), vue()],
});
