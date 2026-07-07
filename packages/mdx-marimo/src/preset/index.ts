import type { ExtractMarimoOptions } from "../extractor";
import { remarkMarimo } from "../remark";
import type { MarimoPageRequest, MarimoPageResult, MdxMarimoOptions } from "../schema";

type ExtractorModule = typeof import("../extractor");

export type MdxMarimoPresetOptions = Omit<MdxMarimoOptions, "extract"> & {
  extract?: MdxMarimoOptions["extract"];
  extractor?: ExtractMarimoOptions;
};

export function marimoMdx({
  cwd = process.cwd(),
  extract,
  extractor,
  output = { type: "element" },
  ...options
}: MdxMarimoPresetOptions = {}): [typeof remarkMarimo, MdxMarimoOptions] {
  const remarkOptions: MdxMarimoOptions = {
    ...options,
    output,
    extract: extract ?? ((request) => defaultExtract(request, extractorOptions(cwd, extractor))),
  };
  remarkOptions.cwd = cwd;
  return [remarkMarimo, remarkOptions];
}

async function defaultExtract(
  request: MarimoPageRequest,
  options: ExtractMarimoOptions,
): Promise<MarimoPageResult> {
  const extractorSubpath: string = "@marimo-team/mdx-marimo/extractor";
  const { extractMarimo } = (await import(extractorSubpath)) as ExtractorModule;
  return extractMarimo(request, options);
}

function extractorOptions(
  cwd: string | undefined,
  options: ExtractMarimoOptions | undefined,
): ExtractMarimoOptions {
  return cwd === undefined ? { ...options } : { ...options, cwd };
}
