import type {
  CompiledMarimoCell,
  CompiledMarimoPage,
  MarimoCellRequest,
  MarimoDiagnostic,
  MarimoPageCompiler,
  MarimoPageRequest,
} from "@marimo-team/islands-bridge/protocol";
import {
  MARIMO_PAGE_PROTOCOL_VERSION,
  pageCellPayload,
} from "@marimo-team/islands-bridge/protocol";
import MarkdownIt from "markdown-it";
import { Buffer } from "node:buffer";
import { fenceLanguage, isMarimoConfigFence, isMarimoFence } from "../../authoring/fences";
import { parseFenceOptions } from "../../authoring/options";
import type { CompileMarimoPageOptions } from "../../node/compile";
import { pageRequest, publicFilename, type MarimoPageIdentity } from "../../remark/identity";

type CompilerModule = typeof import("../../node/compile");
type MarkdownToken = ReturnType<MarkdownIt["parse"]>[number];

export type MarimoVitePressOptions = {
  cwd?: string;
  compile?: MarimoPageCompiler;
  compiler?: CompileMarimoPageOptions;
  identity?: MarimoPageIdentity;
  theme?: "auto" | "light" | "dark";
};

type MarimoEdit = {
  start: number;
  end: number;
  startLine: number;
  prefix: string;
  cellIndex?: number;
};

type CollectedPage = {
  cells: MarimoCellRequest[];
  diagnostics: MarimoDiagnostic[];
  edits: MarimoEdit[];
  pyproject?: string;
};

type MarimoPluginContext = {
  warn(message: string): void;
};

export function marimoVitePress({
  cwd = process.cwd(),
  compile,
  compiler,
  identity,
  theme = "auto",
}: MarimoVitePressOptions = {}) {
  const markdown = new MarkdownIt();
  const compilations = new Map<string, Promise<CompiledMarimoPage>>();
  const compilePage: MarimoPageCompiler =
    compile ??
    ((request) =>
      defaultCompile(request, {
        ...compiler,
        cwd,
      }));

  return {
    name: "mdx-marimo:vitepress",
    enforce: "pre" as const,
    async transform(this: MarimoPluginContext, source: string, id: string) {
      const filePath = id.replace(/\?.*$/, "");
      if (!filePath.endsWith(".md") || !source.includes("marimo")) return null;

      const collected = collectMarimoPage(markdown, source);
      if (collected.edits.length === 0) return null;

      const filename = publicFilename(filePath, cwd);
      for (const diagnostic of collected.diagnostics) {
        this.warn(formatDiagnostic(diagnostic, filename, collected.edits));
      }

      const request = pageRequest({
        cells: collected.cells,
        filename,
        identity,
        filePath,
        pyproject: collected.pyproject,
        source,
      });
      const page =
        collected.cells.length === 0
          ? emptyCompiledPage()
          : await compileOnce(compilations, compilePage, request);
      validateCompiledPage(page, request);
      reportCompilerDiagnostics(this, page.diagnostics, filename, collected.edits);

      const replacements = new Map(
        page.cells.map((cell) => [cell.index, renderMarimoIsland(page, cell, theme)]),
      );
      return {
        code: applyEdits(source, collected.edits, replacements),
        map: null,
      };
    },
  };
}

function collectMarimoPage(markdown: MarkdownIt, source: string): CollectedPage {
  const offsets = lineOffsets(source);
  const cells: MarimoCellRequest[] = [];
  const diagnostics: MarimoDiagnostic[] = [];
  const edits: MarimoEdit[] = [];
  let pyproject: string | undefined;
  let configLine: number | undefined;

  for (const token of markdown.parse(source, {})) {
    if (token.type !== "fence" || !token.map) continue;

    const { language, meta } = fenceInfo(token.info);
    const [startLine, endLine] = token.map;
    const start = offsets[startLine] ?? source.length;
    const end = offsets[endLine] ?? source.length;
    const prefix = fencePrefix(source.slice(start, end), token);

    if (isMarimoConfigFence(language)) {
      if (pyproject === undefined) {
        pyproject = stripFenceTerminator(token.content);
        configLine = startLine + 1;
      } else {
        diagnostics.push({
          severity: "warning",
          line: startLine + 1,
          message: `Duplicate marimo-config fence. The first config fence is on line ${configLine ?? "unknown"}`,
        });
      }
      edits.push({ start, end, startLine, prefix });
      continue;
    }

    if (!isMarimoFence(language, meta)) continue;

    const parsed = parseFenceOptions(fenceLanguage(language), meta);
    for (const diagnostic of parsed.diagnostics) {
      diagnostics.push({
        ...diagnostic,
        cellIndex: cells.length,
        line: startLine + 1,
      });
    }

    const cell: MarimoCellRequest = {
      index: cells.length,
      source: stripFenceTerminator(token.content),
      options: parsed.options,
      startLine: startLine + 1,
      endLine,
    };
    cells.push(cell);
    edits.push({
      start,
      end,
      startLine,
      prefix,
      cellIndex: cell.index,
    });
  }

  return {
    cells,
    diagnostics,
    edits,
    ...(pyproject === undefined ? {} : { pyproject }),
  };
}

function fenceInfo(info: string): { language: string; meta: string } {
  const trimmed = info.trim();
  const separator = trimmed.search(/\s/);
  if (separator === -1) return { language: trimmed, meta: "" };
  return {
    language: trimmed.slice(0, separator),
    meta: trimmed.slice(separator + 1).trim(),
  };
}

function fencePrefix(source: string, token: MarkdownToken): string {
  const openingLine = source.split(/\r?\n/, 1)[0] ?? "";
  const markupIndex = openingLine.indexOf(token.markup);
  return markupIndex === -1 ? "" : openingLine.slice(0, markupIndex);
}

function stripFenceTerminator(source: string): string {
  return source.endsWith("\n") ? source.slice(0, -1) : source;
}

function lineOffsets(source: string): number[] {
  const offsets = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") offsets.push(index + 1);
  }
  return offsets;
}

async function defaultCompile(
  request: MarimoPageRequest,
  options: CompileMarimoPageOptions,
): Promise<CompiledMarimoPage> {
  const { compileMarimoPage } = (await import("@marimo-team/mdx-marimo/node")) as CompilerModule;
  return compileMarimoPage(request, options);
}

async function compileOnce(
  compilations: Map<string, Promise<CompiledMarimoPage>>,
  compile: MarimoPageCompiler,
  request: MarimoPageRequest,
): Promise<CompiledMarimoPage> {
  const key = JSON.stringify(request);
  const cached = compilations.get(key);
  if (cached) return cached;

  const pending = Promise.resolve().then(() => compile(request));
  compilations.set(key, pending);
  void pending.catch(() => {
    if (compilations.get(key) === pending) compilations.delete(key);
  });
  return pending;
}

function emptyCompiledPage(): CompiledMarimoPage {
  return {
    protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
    app: null,
    cells: [],
    diagnostics: [],
  };
}

function validateCompiledPage(page: CompiledMarimoPage, request: MarimoPageRequest): void {
  const actualProtocolVersion = Number(page.protocolVersion);
  const expectedProtocolVersion = Number(request.protocolVersion);
  if (actualProtocolVersion !== expectedProtocolVersion) {
    throw new Error(
      `marimoVitePress compiler returned protocol ${actualProtocolVersion}, expected ${expectedProtocolVersion}`,
    );
  }
  if (page.cells.length !== request.cells.length) {
    throw new Error(
      `marimoVitePress compiler returned ${page.cells.length} cells for ${request.cells.length} marimo cells`,
    );
  }
  for (const [index, cell] of page.cells.entries()) {
    const expected = request.cells[index]?.index;
    if (cell.index !== expected) {
      throw new Error(
        `marimoVitePress compiler returned cell ${cell.index} at position ${index}, expected ${expected}`,
      );
    }
  }
}

function reportCompilerDiagnostics(
  context: MarimoPluginContext,
  diagnostics: MarimoDiagnostic[],
  filename: string,
  edits: MarimoEdit[],
): void {
  const errors: string[] = [];
  for (const diagnostic of diagnostics) {
    const message = formatDiagnostic(diagnostic, filename, edits);
    if (diagnostic.severity === "error") {
      errors.push(message);
    } else {
      context.warn(message);
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
}

function formatDiagnostic(
  diagnostic: MarimoDiagnostic,
  filename: string,
  edits: MarimoEdit[],
): string {
  const editLine =
    diagnostic.cellIndex === undefined
      ? undefined
      : edits.find((edit) => edit.cellIndex === diagnostic.cellIndex)?.startLine;
  const line = diagnostic.line ?? (editLine === undefined ? undefined : editLine + 1);
  return `${filename}${line === undefined ? "" : `:${line}`}: ${diagnostic.message}`;
}

function renderMarimoIsland(
  page: CompiledMarimoPage,
  cell: CompiledMarimoCell,
  theme: "auto" | "light" | "dark",
): string {
  if (
    !cell.options.render.include ||
    (!cell.options.render.source && !cell.options.render.output)
  ) {
    return "";
  }

  const payload = pageCellPayload(page, cell);
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return [
    "<marimo-mdx-island",
    'class="marimo-island-host"',
    'data-marimo-host="mdx"',
    `data-marimo-theme-mode="${theme}"`,
    `data-marimo-app-id="${page.app?.id ?? ""}"`,
    `data-marimo-cell-index="${cell.index}"`,
    'data-marimo-payload-encoding="base64url"',
    `data-marimo-payload="${encodedPayload}"`,
    "></marimo-mdx-island>",
  ].join(" ");
}

function applyEdits(
  source: string,
  edits: MarimoEdit[],
  replacements: Map<number, string>,
): string {
  let output = source;
  for (const edit of [...edits].sort((left, right) => right.start - left.start)) {
    const segment = source.slice(edit.start, edit.end);
    const newlineCount = segment.match(/\n/g)?.length ?? 0;
    const replacement =
      edit.cellIndex === undefined ? "" : `${edit.prefix}${replacements.get(edit.cellIndex) ?? ""}`;
    output =
      output.slice(0, edit.start) +
      replacement +
      "\n".repeat(newlineCount) +
      output.slice(edit.end);
  }
  return output;
}
