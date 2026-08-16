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

export function parseMarimoPageSerializedCellPayload(
  value: JsonValue,
): MarimoPageSerializedCellPayload | undefined {
  if (!isJsonRecord(value) || value.protocolVersion !== MARIMO_PAGE_PROTOCOL_VERSION) {
    return undefined;
  }
  const ownsApp = Object.hasOwn(value, "app");
  const ownsAppId = Object.hasOwn(value, "appId");
  if (ownsApp === ownsAppId) return undefined;
  const cell = parsePageCell(value.cell);
  if (cell === undefined) return undefined;
  if (ownsApp) {
    const app = parsePageRuntime(value.app);
    if (app === undefined) return undefined;
    return {
      protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
      app,
      cell,
    };
  }
  const appId = parseNonEmptyString(value.appId);
  if (appId === undefined) return undefined;
  return {
    protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
    appId,
    cell,
  };
}

export function parseCompiledMarimoPage(value: JsonValue): CompiledMarimoPage | undefined {
  if (!isJsonRecord(value) || value.protocolVersion !== MARIMO_PAGE_PROTOCOL_VERSION) {
    return undefined;
  }
  const app = parsePageRuntime(value.app);
  const cells = parseArray(value.cells, parseCompiledCell);
  const diagnostics = parseArray(value.diagnostics, parseDiagnostic);
  if (app === undefined || cells === undefined || diagnostics === undefined) return undefined;
  return {
    protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
    app,
    cells,
    diagnostics,
  };
}

function parseCompiledCell(value: JsonValue): CompiledMarimoCell | undefined {
  if (!isJsonRecord(value)) return undefined;
  const cell = parsePageCell(value);
  const output = parseCompiledOutput(value.output);
  if (cell === undefined || output === undefined) return undefined;
  return {
    ...cell,
    output,
  };
}

function parsePageCell(value: JsonValue | undefined): MarimoPageCell | undefined {
  if (!isJsonRecord(value)) return undefined;
  const index = parseFiniteNumber(value.index);
  const html = parseString(value.html);
  const options = parseCellOptions(value.options);
  const diagnostics = parseOptionalArray(value.diagnostics, parseDiagnostic);
  if (index === undefined || html === undefined || options === undefined || diagnostics === null) {
    return undefined;
  }
  const cell: MarimoPageCell = { index, html, options };
  if (diagnostics !== undefined) cell.diagnostics = diagnostics;
  return cell;
}

function parseCompiledOutput(
  value: JsonValue | undefined,
): CompiledMarimoOutput | null | undefined {
  if (value === null) return null;
  if (!isJsonRecord(value)) return undefined;
  const mimetype = parseString(value.mimetype);
  const data = value.data === undefined ? undefined : parseJsonValue(value.data);
  const html = parseString(value.html);
  if (mimetype === undefined || data === undefined || html === undefined) return undefined;
  return { mimetype, data, html };
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

function parsePageRuntime(value: JsonValue | undefined): MarimoPageRuntime | null | undefined {
  if (value === null) return null;
  if (!isJsonRecord(value)) return undefined;
  const id = parseNonEmptyString(value.id);
  const runtimeCellCount = parseFiniteNumber(value.runtimeCellCount);
  const assets = parseRuntimeAssets(value.assets);
  const notebookCode = parseOptionalString(value.notebookCode);
  if (
    id === undefined ||
    runtimeCellCount === undefined ||
    assets === undefined ||
    notebookCode === null
  ) {
    return undefined;
  }
  const runtime: MarimoPageRuntime = { id, runtimeCellCount, assets };
  if (notebookCode !== undefined) runtime.notebookCode = notebookCode;
  return runtime;
}

function parseRuntimeAssets(value: JsonValue | undefined): MarimoRuntimeAssets | undefined {
  if (!isJsonRecord(value)) return undefined;
  const moduleScripts = parseArray(value.moduleScripts, parseString);
  const links = parseArray(value.links, parseStringRecord);
  const headTags = parseOptionalArray(value.headTags, parseHeadTag);
  const version = parseOptionalString(value.version);
  if (moduleScripts === undefined || links === undefined || headTags === null || version === null) {
    return undefined;
  }
  const assets: MarimoRuntimeAssets = { moduleScripts, links };
  if (headTags !== undefined) assets.headTags = headTags;
  if (version !== undefined) assets.version = version;
  return assets;
}

function parseHeadTag(
  value: JsonValue,
): NonNullable<MarimoRuntimeAssets["headTags"]>[number] | undefined {
  if (!isJsonRecord(value)) return undefined;
  const tag = parseString(value.tag);
  const attrs = parseStringRecord(value.attrs);
  const text = parseOptionalString(value.text);
  if (tag === undefined || attrs === undefined || text === null) return undefined;
  const headTag: NonNullable<MarimoRuntimeAssets["headTags"]>[number] = { tag, attrs };
  if (text !== undefined) headTag.text = text;
  return headTag;
}

function parseCellOptions(value: JsonValue | undefined): MarimoCellOptions | undefined {
  if (!isJsonRecord(value)) return undefined;
  const language = parseLanguage(value.language);
  const render = parseRenderOptions(value.render);
  const execution = parseExecutionOptions(value.execution);
  const marimo = parseMarimoOptions(value.marimo);
  const sql = parseSqlOptions(value.sql);
  const name = parseOptionalString(value.name);
  const column = parseOptionalFiniteNumber(value.column);
  if (
    language === undefined ||
    render === undefined ||
    execution === undefined ||
    marimo === undefined ||
    sql === null ||
    name === null ||
    column === null
  ) {
    return undefined;
  }
  const options: MarimoCellOptions = { language, render, execution, marimo };
  if (sql !== undefined) options.sql = sql;
  if (name !== undefined) options.name = name;
  if (column !== undefined) options.column = column;
  return options;
}

function parseLanguage(value: JsonValue | undefined): MarimoLanguage | undefined {
  return value === "python" || value === "sql" || value === "markdown" ? value : undefined;
}

function parseExecutionOptions(
  value: JsonValue | undefined,
): MarimoCellOptions["execution"] | undefined {
  if (!isJsonRecord(value)) return undefined;
  const enabled = parseBoolean(value.enabled);
  return enabled === undefined ? undefined : { enabled };
}

function parseMarimoOptions(value: JsonValue | undefined): MarimoCellOptions["marimo"] | undefined {
  if (!isJsonRecord(value)) return undefined;
  const disabled = parseBoolean(value.disabled);
  const unparsable = parseBoolean(value.unparsable);
  return disabled === undefined || unparsable === undefined ? undefined : { disabled, unparsable };
}

function parseSqlOptions(value: JsonValue | undefined): MarimoCellOptions["sql"] | null {
  if (value === undefined) return undefined;
  if (!isJsonRecord(value)) return null;
  const outputName = parseOptionalString(value.outputName);
  const engine = parseOptionalString(value.engine);
  if (outputName === null || engine === null) return null;
  const sql: NonNullable<MarimoCellOptions["sql"]> = {};
  if (outputName !== undefined) sql.outputName = outputName;
  if (engine !== undefined) sql.engine = engine;
  return sql;
}

function parseRenderOptions(value: JsonValue | undefined): MarimoRenderOptions | undefined {
  if (!isJsonRecord(value)) return undefined;
  const source = parseBoolean(value.source);
  const output = parseBoolean(value.output);
  const include = parseBoolean(value.include);
  const editor = parseBoolean(value.editor);
  const error = parseBoolean(value.error);
  const serverOutput = parseBoolean(value.serverOutput);
  if (
    source === undefined ||
    output === undefined ||
    include === undefined ||
    editor === undefined ||
    error === undefined ||
    serverOutput === undefined
  ) {
    return undefined;
  }
  return { source, output, include, editor, error, serverOutput };
}

function parseDiagnostic(value: JsonValue): MarimoDiagnostic | undefined {
  if (!isJsonRecord(value)) return undefined;
  const severity = value.severity;
  const message = parseString(value.message);
  const cellIndex = parseOptionalFiniteNumber(value.cellIndex);
  const line = parseOptionalFiniteNumber(value.line);
  if (
    (severity !== "warning" && severity !== "error") ||
    message === undefined ||
    cellIndex === null ||
    line === null
  ) {
    return undefined;
  }
  const diagnostic: MarimoDiagnostic = { severity, message };
  if (cellIndex !== undefined) diagnostic.cellIndex = cellIndex;
  if (line !== undefined) diagnostic.line = line;
  return diagnostic;
}

function parseJsonValue(value: JsonValue): JsonValue | undefined {
  if (value === null || isString(value) || isBoolean(value)) return value;
  if (isFiniteNumber(value)) return value;
  if (Array.isArray(value)) return parseArray(value, parseJsonValue);
  if (!isJsonRecord(value)) return undefined;
  const record: JsonRecord = {};
  for (const [key, entry] of Object.entries(value)) {
    const parsed = parseJsonValue(entry);
    if (parsed === undefined) return undefined;
    Object.defineProperty(record, key, {
      configurable: true,
      enumerable: true,
      value: parsed,
      writable: true,
    });
  }
  return record;
}

function parseStringRecord(value: JsonValue | undefined): Record<string, string> | undefined {
  if (!isJsonRecord(value)) return undefined;
  const record: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    const parsed = parseString(entry);
    if (parsed === undefined) return undefined;
    Object.defineProperty(record, key, {
      configurable: true,
      enumerable: true,
      value: parsed,
      writable: true,
    });
  }
  return record;
}

function parseArray<T>(
  value: JsonValue | undefined,
  parser: (entry: JsonValue) => T | undefined,
): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const parsed: T[] = [];
  for (const entry of value) {
    const item = parser(entry);
    if (item === undefined) return undefined;
    parsed.push(item);
  }
  return parsed;
}

function parseOptionalArray<T>(
  value: JsonValue | undefined,
  parser: (entry: JsonValue) => T | undefined,
): T[] | undefined | null {
  return value === undefined ? undefined : (parseArray(value, parser) ?? null);
}

function parseString(value: JsonValue | undefined): string | undefined {
  return isString(value) ? value : undefined;
}

function parseNonEmptyString(value: JsonValue | undefined): string | undefined {
  const parsed = parseString(value);
  return parsed && parsed.length > 0 ? parsed : undefined;
}

function parseOptionalString(value: JsonValue | undefined): string | undefined | null {
  return value === undefined ? undefined : (parseString(value) ?? null);
}

function parseBoolean(value: JsonValue | undefined): boolean | undefined {
  return isBoolean(value) ? value : undefined;
}

function parseFiniteNumber(value: JsonValue | undefined): number | undefined {
  return isFiniteNumber(value) ? value : undefined;
}

function parseOptionalFiniteNumber(value: JsonValue | undefined): number | undefined | null {
  return value === undefined ? undefined : (parseFiniteNumber(value) ?? null);
}

function isString(value: JsonValue | undefined): value is string {
  return (
    value !== undefined &&
    value !== null &&
    Object.getPrototypeOf(value) === String.prototype &&
    Object(value) !== value
  );
}

function isBoolean(value: JsonValue | undefined): value is boolean {
  return value === true || value === false;
}

function isFiniteNumber(value: JsonValue | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function isJsonRecord(value: JsonValue | undefined): value is JsonRecord {
  if (value === undefined || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (
    prototype === Object.prototype ||
    prototype === null ||
    Object.getPrototypeOf(prototype) === null
  );
}
