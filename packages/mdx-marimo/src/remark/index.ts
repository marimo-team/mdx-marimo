import type { Root } from "mdast";
import type { Plugin } from "unified";
import {
  MARIMO_PAGE_PROTOCOL_VERSION,
  type CompiledMarimoPage,
  type JsonPrimitive,
  type JsonRecord,
  type JsonValue,
  type MarimoCellOptions,
  type MarimoCellOptionsPatch,
  type MarimoCellRequest,
  type MarimoDiagnostic,
  type MarimoLanguage,
  type MarimoPageCompiler,
  type MarimoPageRequest,
  type MarimoRuntimeAssets,
  type MarimoPageRuntime,
} from "@marimo-team/islands-bridge/protocol";
import { fenceLanguage, isMarimoConfigFence, isMarimoFence } from "../authoring/fences";
import { parseFenceOptions } from "../authoring/options";
import { defaultMarimoElementName } from "../element/name";
import type { CompileMarimoPageOptions } from "../node/compile";
import { sideEffectImportNode } from "../mdx/nodes";
import { collectMarimoPage } from "./collect";
import { applyTreeEdits, reportDiagnostic } from "./edits";
import { pageRequest, publicFilename, type MarimoPageIdentity } from "./identity";

type CompilerModule = typeof import("../node/compile");

export type MarimoElementOptions = {
  name?: string;
  runtimeImport?: string;
  theme?: "auto" | "light" | "dark";
};

export type RemarkMarimoOptions = {
  cwd?: string;
  element?: MarimoElementOptions;
  identity?: MarimoPageIdentity;
  compile?: MarimoPageCompiler;
  compiler?: CompileMarimoPageOptions;
};

export const remarkMarimo: Plugin<[RemarkMarimoOptions?], Root> = ({
  cwd = process.cwd(),
  element = {},
  compile,
  compiler,
  identity,
}: RemarkMarimoOptions = {}) => {
  return async (tree, file) => {
    const collected = collectMarimoPage(tree, file);
    if (collected.edits.length === 0) return;

    const filename = publicFilename(file.path || String(file.history[0] || "document.mdx"), cwd);
    const request = pageRequest({
      cells: collected.cells,
      filename,
      identity,
      filePath: file.path || undefined,
      pyproject: collected.pyproject,
      source: String(file.value),
    });
    const result =
      collected.cells.length > 0
        ? await runCompiler(compile, request, compilerOptions(cwd, compiler))
        : emptyCompiledPage();
    validateCompiledPage(result, request);
    for (const diagnostic of result.diagnostics) {
      reportDiagnostic(file, diagnostic);
    }
    const didReplace = applyTreeEdits(collected.edits, result, {
      elementName: element.name ?? defaultMarimoElementName,
      theme: element.theme ?? "auto",
    });

    if (didReplace && element.runtimeImport) {
      tree.children.unshift(sideEffectImportNode(element.runtimeImport));
    }
  };
};

export { fenceLanguage, isMarimoConfigFence, isMarimoFence, parseFenceOptions };
export type { MarimoPageIdentity } from "./identity";
export type {
  CompiledMarimoPage,
  JsonPrimitive,
  JsonRecord,
  JsonValue,
  MarimoCellOptions,
  MarimoCellOptionsPatch,
  MarimoCellRequest,
  MarimoDiagnostic,
  MarimoLanguage,
  MarimoPageCompiler,
  MarimoPageRequest,
  MarimoRuntimeAssets,
  MarimoPageRuntime,
};

function runCompiler(
  compile: RemarkMarimoOptions["compile"],
  request: MarimoPageRequest,
  options: CompileMarimoPageOptions,
): Promise<CompiledMarimoPage> | CompiledMarimoPage {
  return compile ? compile(request) : defaultCompile(request, options);
}

async function defaultCompile(
  request: MarimoPageRequest,
  options: CompileMarimoPageOptions,
): Promise<CompiledMarimoPage> {
  const { compileMarimoPage } = (await import("@marimo-team/mdx-marimo/node")) as CompilerModule;
  return compileMarimoPage(request, options);
}

function compilerOptions(
  cwd: string | undefined,
  options: CompileMarimoPageOptions | undefined,
): CompileMarimoPageOptions {
  return cwd === undefined ? { ...options } : { ...options, cwd };
}

function emptyCompiledPage(): CompiledMarimoPage {
  return {
    protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
    app: null,
    cells: [],
    diagnostics: [],
  };
}

function validateCompiledPage(result: CompiledMarimoPage, request: MarimoPageRequest): void {
  if (result.protocolVersion !== MARIMO_PAGE_PROTOCOL_VERSION) {
    throw new Error(`remarkMarimo compiler returned protocol ${String(result.protocolVersion)}`);
  }
  if (result.cells.length !== request.cells.length) {
    throw new Error(
      `remarkMarimo compiler returned ${result.cells.length} cells for ${request.cells.length} marimo cells`,
    );
  }
  for (const [index, cell] of result.cells.entries()) {
    const expected = request.cells[index]?.index;
    if (cell.index !== expected) {
      throw new Error(
        `remarkMarimo compiler returned cell ${cell.index} at position ${index}; expected ${expected}`,
      );
    }
  }
}
