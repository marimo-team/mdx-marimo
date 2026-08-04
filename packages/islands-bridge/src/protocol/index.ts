export const MARIMO_PAGE_PROTOCOL_VERSION = 2 as const;

export type MarimoPageProtocolVersion = typeof MARIMO_PAGE_PROTOCOL_VERSION;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonRecord | JsonValue[];
export type JsonRecord = {
  [key: string]: JsonValue;
};

export type MarimoLanguage = "python" | "sql" | "markdown";

export type MarimoDiagnostic = {
  severity: "warning" | "error";
  message: string;
  cellIndex?: number;
  line?: number;
};

export type MarimoRenderOptions = {
  source: boolean;
  output: boolean;
  include: boolean;
  editor: boolean;
  error: boolean;
  serverOutput: boolean;
};

export type MarimoCellOptions = {
  language: MarimoLanguage;
  render: MarimoRenderOptions;
  execution: {
    enabled: boolean;
  };
  marimo: {
    disabled: boolean;
    unparsable: boolean;
  };
  sql?: {
    outputName?: string;
    engine?: string;
  };
  name?: string;
  column?: number;
};

export type MarimoCellOptionsPatch = {
  language?: MarimoLanguage;
  render?: Partial<MarimoRenderOptions>;
  execution?: Partial<MarimoCellOptions["execution"]>;
  marimo?: Partial<MarimoCellOptions["marimo"]>;
  sql?: MarimoCellOptions["sql"];
  name?: string;
  column?: number;
};

export type MarimoCellRequest = {
  index: number;
  source: string;
  options: MarimoCellOptionsPatch;
  startLine?: number;
  endLine?: number;
};

export type MarimoPageRequest = {
  protocolVersion: MarimoPageProtocolVersion;
  identity: string;
  filename?: string;
  metadata: {
    pyproject?: string;
    setupCells?: MarimoCellRequest[];
  };
  defaults?: MarimoCellOptionsPatch;
  cells: MarimoCellRequest[];
};

export type MarimoRuntimeAssets = {
  moduleScripts: string[];
  links: Record<string, string>[];
  headTags?: {
    tag: string;
    attrs: Record<string, string>;
    text?: string;
  }[];
  version?: string;
};

export type MarimoPageRuntime = {
  id: string;
  runtimeCellCount: number;
  assets: MarimoRuntimeAssets;
  notebookCode?: string;
};

export type CompiledMarimoOutput = {
  mimetype: string;
  data: JsonValue;
  html: string;
};

export type CompiledMarimoCell = {
  index: number;
  html: string;
  options: MarimoCellOptions;
  output: CompiledMarimoOutput | null;
  diagnostics?: MarimoDiagnostic[];
};

export type CompiledMarimoPage = {
  protocolVersion: MarimoPageProtocolVersion;
  app: MarimoPageRuntime | null;
  cells: CompiledMarimoCell[];
  diagnostics: MarimoDiagnostic[];
};

export type MarimoPageCell = Omit<CompiledMarimoCell, "output">;

export type MarimoPageCellPayload = {
  protocolVersion: MarimoPageProtocolVersion;
  app: MarimoPageRuntime | null;
  cell: MarimoPageCell;
};

export type MarimoPageCellReferencePayload = {
  protocolVersion: MarimoPageProtocolVersion;
  appId: string;
  cell: MarimoPageCell;
};

export type MarimoPageSerializedCellPayload =
  | MarimoPageCellPayload
  | MarimoPageCellReferencePayload;

export type ProjectedMarimoPageCellPayload = MarimoPageSerializedCellPayload | null;

export type MarimoPageCompiler = (
  request: MarimoPageRequest,
) => CompiledMarimoPage | Promise<CompiledMarimoPage>;

export function pageCellPayload(
  page: Pick<CompiledMarimoPage, "protocolVersion" | "app">,
  cell: CompiledMarimoCell,
): MarimoPageCellPayload {
  return {
    protocolVersion: page.protocolVersion,
    app: page.app,
    cell: pageCell(cell),
  };
}

export function pageCellReferencePayload(
  page: Pick<CompiledMarimoPage, "protocolVersion" | "app">,
  cell: CompiledMarimoCell,
): MarimoPageSerializedCellPayload {
  if (!page.app) return pageCellPayload(page, cell);
  return {
    protocolVersion: page.protocolVersion,
    appId: page.app.id,
    cell: pageCell(cell),
  };
}

export function projectPageCellPayloads(
  page: CompiledMarimoPage,
): ProjectedMarimoPageCellPayload[] {
  const indices = page.cells.map((cell) => cell.index);
  if (indices.some((index, position) => index !== position)) {
    const expected = page.cells.map((_, index) => index);
    throw new Error(
      `marimo compiler returned cell indices [${indices.join(", ")}]; expected [${expected.join(", ")}]`,
    );
  }
  const carrierIndex = page.app
    ? page.cells.find((cell) => cell.options.render.include)?.index
    : undefined;
  return page.cells.map((cell) => {
    if (!cell.options.render.include) return null;
    return cell.index === carrierIndex
      ? pageCellPayload(page, cell)
      : pageCellReferencePayload(page, cell);
  });
}

export function encodePageCellPayload(payload: MarimoPageSerializedCellPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function isMarimoPageCellPayload(value: unknown): value is MarimoPageCellPayload {
  if (!isRecord(value) || value.protocolVersion !== MARIMO_PAGE_PROTOCOL_VERSION) return false;
  if (!isPageCell(value.cell)) return false;
  return value.app === null || isPageRuntime(value.app);
}

export function isMarimoPageCellReferencePayload(
  value: unknown,
): value is MarimoPageCellReferencePayload {
  return (
    isRecord(value) &&
    value.protocolVersion === MARIMO_PAGE_PROTOCOL_VERSION &&
    typeof value.appId === "string" &&
    value.appId.length > 0 &&
    isPageCell(value.cell)
  );
}

export function isCompiledMarimoPage(value: unknown): value is CompiledMarimoPage {
  return (
    isRecord(value) &&
    value.protocolVersion === MARIMO_PAGE_PROTOCOL_VERSION &&
    (value.app === null || isPageRuntime(value.app)) &&
    isArrayOf(value.cells, isCompiledCell) &&
    isArrayOf(value.diagnostics, isDiagnostic)
  );
}

function isCompiledCell(value: unknown): value is CompiledMarimoCell {
  return isPageCell(value) && "output" in value && isCompiledOutput(value.output);
}

function isPageCell(value: unknown): value is MarimoPageCell {
  return (
    isRecord(value) &&
    isFiniteNumber(value.index) &&
    typeof value.html === "string" &&
    isCellOptions(value.options) &&
    (value.diagnostics === undefined || isArrayOf(value.diagnostics, isDiagnostic))
  );
}

function isCompiledOutput(value: unknown): value is CompiledMarimoOutput | null {
  return (
    value === null ||
    (isRecord(value) &&
      typeof value.mimetype === "string" &&
      isJsonValue(value.data) &&
      typeof value.html === "string")
  );
}

function pageCell(cell: CompiledMarimoCell): MarimoPageCell {
  const projected: MarimoPageCell = {
    index: cell.index,
    html: cell.html,
    options: cell.options,
  };
  if (cell.diagnostics !== undefined) projected.diagnostics = cell.diagnostics;
  return projected;
}

function isPageRuntime(value: unknown): value is MarimoPageRuntime {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    isFiniteNumber(value.runtimeCellCount) &&
    isRuntimeAssets(value.assets) &&
    (value.notebookCode === undefined || typeof value.notebookCode === "string")
  );
}

function isRuntimeAssets(value: unknown): value is MarimoRuntimeAssets {
  return (
    isRecord(value) &&
    isArrayOf(value.moduleScripts, isString) &&
    isArrayOf(value.links, isStringRecord) &&
    (value.headTags === undefined || isArrayOf(value.headTags, isHeadTag)) &&
    (value.version === undefined || typeof value.version === "string")
  );
}

function isHeadTag(value: unknown): value is NonNullable<MarimoRuntimeAssets["headTags"]>[number] {
  return (
    isRecord(value) &&
    typeof value.tag === "string" &&
    isStringRecord(value.attrs) &&
    (value.text === undefined || typeof value.text === "string")
  );
}

function isCellOptions(value: unknown): value is MarimoCellOptions {
  return (
    isRecord(value) &&
    (value.language === "python" || value.language === "sql" || value.language === "markdown") &&
    isRenderOptions(value.render) &&
    isRecord(value.execution) &&
    typeof value.execution.enabled === "boolean" &&
    isRecord(value.marimo) &&
    typeof value.marimo.disabled === "boolean" &&
    typeof value.marimo.unparsable === "boolean" &&
    (value.sql === undefined ||
      (isRecord(value.sql) &&
        (value.sql.outputName === undefined || typeof value.sql.outputName === "string") &&
        (value.sql.engine === undefined || typeof value.sql.engine === "string"))) &&
    (value.name === undefined || typeof value.name === "string") &&
    (value.column === undefined || isFiniteNumber(value.column))
  );
}

function isRenderOptions(value: unknown): value is MarimoRenderOptions {
  return (
    isRecord(value) &&
    typeof value.source === "boolean" &&
    typeof value.output === "boolean" &&
    typeof value.include === "boolean" &&
    typeof value.editor === "boolean" &&
    typeof value.error === "boolean" &&
    typeof value.serverOutput === "boolean"
  );
}

function isDiagnostic(value: unknown): value is MarimoDiagnostic {
  return (
    isRecord(value) &&
    (value.severity === "warning" || value.severity === "error") &&
    typeof value.message === "string" &&
    (value.cellIndex === undefined || isFiniteNumber(value.cellIndex)) &&
    (value.line === undefined || isFiniteNumber(value.line))
  );
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (isFiniteNumber(value)) return true;
  if (Array.isArray(value)) return Array.from(value).every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every(isString);
}

function isArrayOf<T>(value: unknown, guard: (entry: unknown) => entry is T): value is T[] {
  return Array.isArray(value) && Array.from(value).every(guard);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
