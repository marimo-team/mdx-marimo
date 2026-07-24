import { marimoVitePress } from "@marimo-team/mdx-marimo/vitepress";
import { defineConfig } from "vitepress";

export default defineConfig({
  cleanUrls: true,
  description: "Reactive marimo cells in VitePress Markdown pages.",
  srcExclude: ["README.md"],
  themeConfig: {
    nav: [
      { text: "Shared page", link: "/" },
      { text: "Second page", link: "/second" },
    ],
    sidebar: [
      { text: "Shared page", link: "/" },
      { text: "Second page", link: "/second" },
    ],
  },
  title: "VitePress marimo",
  vite: {
    plugins: [marimoVitePress()],
  },
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag === "marimo-mdx-island",
      },
    },
  },
});
