import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import { defineConfig } from "astro/config";
import { remarkMarimo } from "@marimo-team/mdx-marimo/remark";

export default defineConfig({
  integrations: [
    mdx({
      processor: unified({
        remarkPlugins: [remarkMarimo],
      }),
    }),
  ],
});
