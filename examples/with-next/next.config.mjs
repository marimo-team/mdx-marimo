import createMDX from "@next/mdx";
import { remarkMarimo } from "@marimo-team/mdx-marimo/remark";

/** @type {import("next").NextConfig} */
const nextConfig = {
  pageExtensions: ["js", "jsx", "mdx"],
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkMarimo],
  },
});

export default withMDX(nextConfig);
