import type {
  MarimoCellOptionsPatch,
  MarimoDiagnostic,
  MarimoLanguage,
} from "@marimo-team/mdx-marimo/bridge/protocol";

type RawFenceOptions = {
  echo?: boolean;
  output?: boolean;
  error?: boolean;
  include?: boolean;
  eval?: boolean;
  editor?: boolean;
  disabled?: boolean;
  "server-output"?: boolean;
  unparsable?: boolean;
  "hide-code"?: boolean;
  "hide-output"?: boolean;
  query?: string;
  engine?: string;
  name?: string;
  column?: number;
};

export type ParsedFenceOptions = {
  options: MarimoCellOptionsPatch;
  diagnostics: MarimoDiagnostic[];
};

export function parseFenceOptions(
  language: MarimoLanguage,
  meta: string | null | undefined,
): ParsedFenceOptions {
  const rawOptions: RawFenceOptions = {};
  const diagnostics: MarimoDiagnostic[] = [];
  const seen = new Set<string>();
  for (const token of metaTokens(meta ?? "")) {
    if (token === "marimo") continue;
    const [rawKey, rawValue] = splitToken(token);
    const key = normalizeOptionKey(rawKey);
    if (!key) continue;
    if (seen.has(key)) {
      diagnostics.push({
        severity: "warning",
        message: `Duplicate marimo option: ${key}`,
      });
      continue;
    }
    seen.add(key);
    switch (key) {
      case "echo":
      case "output":
      case "error":
      case "include":
      case "eval":
      case "editor":
      case "disabled":
      case "server-output":
      case "unparsable":
      case "hide-code":
      case "hide-output":
        rawOptions[key] = parseBoolean(rawValue);
        break;
      case "query":
      case "engine":
      case "name":
        rawOptions[key] = parseString(rawValue);
        break;
      case "column": {
        const value = parseNumber(rawValue);
        if (Number.isNaN(value)) {
          diagnostics.push({
            severity: "warning",
            message: `Invalid numeric marimo option: ${key}`,
          });
        } else {
          rawOptions.column = value;
        }
        break;
      }
      default:
        diagnostics.push({
          severity: "warning",
          message: `Unknown marimo option: ${key}`,
        });
    }
  }
  return { options: normalizeCellOptions(language, rawOptions), diagnostics };
}

function normalizeCellOptions(
  language: MarimoLanguage,
  rawOptions: RawFenceOptions,
): MarimoCellOptionsPatch {
  const render: NonNullable<MarimoCellOptionsPatch["render"]> = {};
  const execution: NonNullable<MarimoCellOptionsPatch["execution"]> = {};
  const marimo: NonNullable<MarimoCellOptionsPatch["marimo"]> = {};
  if (rawOptions.echo !== undefined) render.source = rawOptions.echo;
  if (rawOptions.output !== undefined) render.output = rawOptions.output;
  if (rawOptions.include !== undefined) render.include = rawOptions.include;
  if (rawOptions.editor !== undefined) render.editor = rawOptions.editor;
  if (rawOptions.error !== undefined) render.error = rawOptions.error;
  if (rawOptions["server-output"] !== undefined) {
    render.serverOutput = rawOptions["server-output"];
  }
  if (render.editor) render.source = true;
  const hideCode = rawOptions["hide-code"] ?? false;
  if (hideCode) {
    render.source = false;
    render.editor = false;
  }
  if (rawOptions["hide-output"]) render.output = false;
  if (rawOptions.eval !== undefined) execution.enabled = rawOptions.eval;
  if (rawOptions.disabled !== undefined) marimo.disabled = rawOptions.disabled;
  if (rawOptions.unparsable !== undefined) {
    marimo.unparsable = rawOptions.unparsable;
    if (marimo.unparsable && !hideCode) render.source = true;
  }
  if (marimo.disabled || marimo.unparsable) execution.enabled = false;

  const options: MarimoCellOptionsPatch = {
    language,
  };
  if (Object.keys(render).length > 0) options.render = render;
  if (Object.keys(execution).length > 0) options.execution = execution;
  if (Object.keys(marimo).length > 0) options.marimo = marimo;
  const query = rawOptions.query;
  const engine = rawOptions.engine;
  if (language === "sql" && (query !== undefined || engine !== undefined)) {
    const sql: NonNullable<MarimoCellOptionsPatch["sql"]> = {};
    if (query !== undefined) sql.outputName = query;
    if (engine !== undefined) sql.engine = engine;
    options.sql = sql;
  }
  if (rawOptions.name !== undefined) options.name = rawOptions.name;
  if (rawOptions.column !== undefined) options.column = rawOptions.column;
  return options;
}

function metaTokens(meta: string): string[] {
  const tokens: string[] = [];
  const pattern = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;
  for (const match of meta.matchAll(pattern)) tokens.push(match[0]);
  return tokens;
}

function splitToken(token: string): [string, string | undefined] {
  const equals = token.indexOf("=");
  if (equals === -1) return [token, "true"];
  return [token.slice(0, equals), token.slice(equals + 1)];
}

function normalizeOptionKey(key: string): string {
  return key.trim().replace(/^:/, "").replaceAll("_", "-").toLowerCase();
}

function parseBoolean(value: string | undefined): boolean {
  if (value === undefined) return true;
  return stripQuotes(value.trim()).toLowerCase() !== "false";
}

function parseString(value: string | undefined): string {
  if (value === undefined) return "true";
  const trimmed = stripQuotes(value.trim());
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase();
  return trimmed;
}

function parseNumber(value: string | undefined): number {
  if (value === undefined || /^true$/i.test(stripQuotes(value.trim()))) return 1;
  if (/^false$/i.test(stripQuotes(value.trim()))) return 0;
  return Number(stripQuotes(value.trim()));
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
