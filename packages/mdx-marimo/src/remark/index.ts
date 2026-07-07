import type { Root } from "mdast";
import type { Plugin } from "unified";
import { fenceLanguage, isMarimoConfigFence, isMarimoFence } from "../authoring/fences";
import { parseFenceOptions } from "../authoring/options";
import { defaultMarimoElementName } from "../element/name";
import { importNode, sideEffectImportNode } from "../mdx/nodes";
import type {
  JsonPrimitive,
  JsonRecord,
  JsonValue,
  MarimoCell,
  MarimoCellOptions,
  MarimoDiagnostic,
  MarimoExtractor,
  MarimoLanguage,
  MarimoMdxOutput,
  MarimoOutput,
  MarimoPageRequest,
  MarimoPageResult,
  MarimoRuntimeAssets,
  MdxMarimoOptions,
} from "../schema";
import { collectMarimoPage } from "./collect";
import { applyTreeEdits, reportDiagnostic } from "./edits";
import { pageRequest, publicFilename } from "./identity";

export const remarkMarimo: Plugin<[MdxMarimoOptions?], Root> = (
  {
    cwd,
    extract,
    identity,
    output = { type: "element" },
  }: MdxMarimoOptions = {} as MdxMarimoOptions,
) => {
  return async (tree, file) => {
    const collected = collectMarimoPage(tree, file);
    if (collected.edits.length === 0) return;

    const filename = publicFilename(file.path || String(file.history[0] || "document.mdx"), cwd);
    const request = pageRequest({
      cells: collected.cells,
      diagnostics: collected.diagnostics,
      filename,
      identity,
      filePath: file.path || undefined,
      pyproject: collected.pyproject,
    });
    const result =
      collected.cells.length > 0 ? await runExtract(extract, request) : { outputs: [] };
    if (result.outputs.length !== collected.cells.length) {
      throw new Error(
        `remarkMarimo extract returned ${result.outputs.length} outputs for ${collected.cells.length} marimo cells`,
      );
    }
    for (const diagnostic of result.diagnostics ?? []) {
      reportDiagnostic(file, diagnostic);
    }
    const outputMode = resolveOutput(output);
    const didReplace = applyTreeEdits(
      collected.edits,
      result,
      outputMode.type === "component"
        ? { type: "component", componentName: outputMode.componentName }
        : {
            type: "element",
            elementName: outputMode.elementName,
            theme: outputMode.theme,
          },
    );

    if (didReplace && outputMode.type === "component") {
      tree.children.unshift(
        importNode({
          componentName: outputMode.componentName,
          importName: outputMode.importName,
          importSource: outputMode.importSource,
        }),
      );
    }
    if (didReplace && outputMode.type === "element" && outputMode.clientImportSource) {
      tree.children.unshift(sideEffectImportNode(outputMode.clientImportSource));
    }
  };
};

export default remarkMarimo;
export { fenceLanguage, isMarimoConfigFence, isMarimoFence, parseFenceOptions };
export type {
  JsonPrimitive,
  JsonRecord,
  JsonValue,
  MarimoCell,
  MarimoCellOptions,
  MarimoDiagnostic,
  MarimoExtractor,
  MarimoLanguage,
  MarimoMdxOutput,
  MarimoOutput,
  MarimoPageRequest,
  MarimoPageResult,
  MarimoRuntimeAssets,
  MdxMarimoOptions,
};

function runExtract(
  extract: MdxMarimoOptions["extract"],
  request: MarimoPageRequest,
): Promise<MarimoPageResult> | MarimoPageResult {
  if (!extract) {
    throw new Error("remarkMarimo requires an extract function for marimo fences");
  }
  return extract(request);
}

type ResolvedMarimoMdxOutput =
  | {
      type: "element";
      elementName: string;
      clientImportSource?: string;
      theme: "auto" | "light" | "dark";
    }
  | {
      type: "component";
      componentName: string;
      importSource: string;
      importName?: string;
    };

function resolveOutput(output: MarimoMdxOutput): ResolvedMarimoMdxOutput {
  if (output.type === "component") {
    return {
      type: "component",
      componentName: output.componentName ?? "MarimoIsland",
      importSource: output.importSource,
      ...(output.importName === undefined ? {} : { importName: output.importName }),
    };
  }
  return {
    type: "element",
    elementName: output.elementName ?? defaultMarimoElementName,
    ...(output.clientImportSource === undefined
      ? {}
      : { clientImportSource: output.clientImportSource }),
    theme: output.theme ?? "auto",
  };
}
