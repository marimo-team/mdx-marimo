import createMDX from "@next/mdx";
import { marimoReactMdx } from "@marimo-team/mdx-marimo/react";

/** @type {import("next").NextConfig} */
const nextConfig = {
  pageExtensions: ["js", "jsx", "mdx"],
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [marimoReactMdx()],
  },
});

export default withMDX(nextConfig);
