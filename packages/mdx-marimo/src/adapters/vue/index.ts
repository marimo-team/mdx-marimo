import mdx from "@mdx-js/rollup";
import { marimoMdx, type MdxMarimoPresetOptions } from "../../preset";

type MdxOptions = NonNullable<Parameters<typeof mdx>[0]>;

export type MarimoVueMdxOptions = MdxMarimoPresetOptions & {
  mdx?: MdxOptions;
};

export type MarimoVueMdxPlugin = {
  name: string;
  enforce: "pre";
};

export function marimoVueMdx({
  mdx: mdxOptions = {},
  ...marimoOptions
}: MarimoVueMdxOptions = {}): MarimoVueMdxPlugin {
  const {
    jsxImportSource = "vue",
    providerImportSource = "@mdx-js/vue",
    remarkPlugins,
    ...options
  } = mdxOptions;

  return {
    enforce: "pre",
    ...mdx({
      ...options,
      jsxImportSource,
      providerImportSource,
      remarkPlugins: [...(remarkPlugins ?? []), marimoMdx(marimoOptions)],
    }),
  } as MarimoVueMdxPlugin;
}

export { marimoVueMdx as mdxMarimoVue };
