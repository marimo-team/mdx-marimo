import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import { defineConfig } from "astro/config";
import { marimoMdx } from "@marimo-team/mdx-marimo/preset";

export default defineConfig({
  integrations: [
    mdx({
      processor: unified({
        remarkPlugins: [marimoMdx()],
      }),
    }),
  ],
});
