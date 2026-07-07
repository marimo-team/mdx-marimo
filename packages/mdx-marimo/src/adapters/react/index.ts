import { extractMarimo, type ExtractMarimoOptions } from "@marimo-team/mdx-marimo/extractor";
import { remarkMarimo } from "@marimo-team/mdx-marimo/remark";
import type {
  MarimoMdxComponentOutput,
  MarimoPageRequest,
  MarimoPageResult,
  MdxMarimoOptions,
} from "@marimo-team/mdx-marimo/schema";

export { MarimoIsland } from "./MarimoIsland";
export type { MarimoIslandProps, MarimoIslandStyle, MarimoIslandTheme } from "./MarimoIsland";

export type MarimoReactMdxOptions = Omit<MdxMarimoOptions, "extract" | "output"> & {
  extract?: MdxMarimoOptions["extract"];
  extractor?: ExtractMarimoOptions;
  output?: Partial<Omit<MarimoMdxComponentOutput, "type">>;
};

export function marimoReactMdx({
  cwd = process.cwd(),
  extract,
  extractor,
  output = {},
  ...options
}: MarimoReactMdxOptions = {}): [typeof remarkMarimo, MdxMarimoOptions] {
  const {
    componentName = "MarimoIsland",
    importSource = "@marimo-team/mdx-marimo/react",
    importName,
  } = output;
  return [
    remarkMarimo,
    {
      ...options,
      cwd,
      output: {
        type: "component",
        componentName,
        importSource,
        ...(importName === undefined ? {} : { importName }),
      },
      extract: extract ?? ((request) => defaultExtract(request, extractorOptions(cwd, extractor))),
    },
  ];
}

function defaultExtract(
  request: MarimoPageRequest,
  options: ExtractMarimoOptions,
): Promise<MarimoPageResult> {
  return extractMarimo(request, options);
}

function extractorOptions(
  cwd: string,
  options: ExtractMarimoOptions | undefined,
): ExtractMarimoOptions {
  return { ...options, cwd };
}
