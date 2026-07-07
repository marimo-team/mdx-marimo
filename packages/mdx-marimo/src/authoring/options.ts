import type { MarimoCellOptions, MarimoDiagnostic, MarimoLanguage } from "../schema";

const booleanKeys = new Set([
  "echo",
  "output",
  "error",
  "include",
  "eval",
  "editor",
  "disabled",
  "server-output",
  "unparsable",
  "hide-code",
  "hide-output",
]);

const stringKeys = new Set(["query", "engine", "name"]);
const numberKeys = new Set(["column"]);

export type ParsedFenceOptions = {
  options: MarimoCellOptions;
  diagnostics: MarimoDiagnostic[];
};

export function parseFenceOptions(
  language: MarimoLanguage,
  meta: string | null | undefined,
): ParsedFenceOptions {
  const rawOptions: Record<string, string | boolean | number> = {};
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
    if (booleanKeys.has(key)) {
      rawOptions[key] = parseBoolean(rawValue);
    } else if (stringKeys.has(key)) {
      rawOptions[key] = String(parseScalar(rawValue));
    } else if (numberKeys.has(key)) {
      const value = Number(parseScalar(rawValue));
      if (Number.isNaN(value)) {
        diagnostics.push({
          severity: "warning",
          message: `Invalid numeric marimo option: ${key}`,
        });
      } else {
        rawOptions[key] = value;
      }
    } else {
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
  rawOptions: Record<string, string | boolean | number>,
): MarimoCellOptions {
  const include = readBoolean(rawOptions.include, true);
  const echo = readBoolean(rawOptions.echo, false);
  const output = readBoolean(rawOptions.output, true);
  const error = readBoolean(rawOptions.error, true);
  const editor = readBoolean(rawOptions.editor, false);
  const evalEnabled = readBoolean(rawOptions.eval, true);
  const disabled = readBoolean(rawOptions.disabled, false);
  const unparsable = readBoolean(rawOptions.unparsable, false);
  const hideCode = readBoolean(rawOptions["hide-code"], false);
  const hideOutput = readBoolean(rawOptions["hide-output"], false);
  const serverOutput = readBoolean(rawOptions["server-output"], true);
  const options: MarimoCellOptions = {
    language,
    render: {
      source: include && (echo || editor) && !hideCode,
      output: include && output && !hideOutput,
      include,
      editor,
      error,
      serverOutput,
    },
    execution: {
      enabled: evalEnabled && !disabled && !unparsable,
    },
    marimo: {
      disabled,
      unparsable,
    },
  };
  const query = rawOptions.query;
  const engine = rawOptions.engine;
  if (typeof query === "string" || typeof engine === "string") {
    options.sql = {};
    if (typeof query === "string") options.sql.outputName = query;
    if (typeof engine === "string") options.sql.engine = engine;
  }
  if (typeof rawOptions.name === "string") options.name = rawOptions.name;
  if (typeof rawOptions.column === "number") options.column = rawOptions.column;
  return options;
}

function readBoolean(value: string | boolean | number | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return value.toLowerCase() !== "false";
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
  const scalar = parseScalar(value);
  if (typeof scalar === "boolean") return scalar;
  return String(scalar).toLowerCase() !== "false";
}

function parseScalar(value: string | undefined): string | boolean | number {
  if (value === undefined) return true;
  const trimmed = stripQuotes(value.trim());
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === "true";
  const number = Number(trimmed);
  if (trimmed && !Number.isNaN(number) && String(number) === trimmed) return number;
  return trimmed;
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
