import type { MarimoLanguage } from "../schema";

export function isMarimoFence(
  lang: string | null | undefined,
  meta: string | null | undefined,
): boolean {
  if (!lang) return false;
  if (lang.endsWith(".marimo")) return isSupportedLanguage(lang.slice(0, -".marimo".length));
  if (!isSupportedLanguage(lang)) return false;
  return metaTokens(meta ?? "").includes("marimo");
}

export function isMarimoConfigFence(lang: string | null | undefined): boolean {
  return lang === "marimo-config";
}

export function fenceLanguage(lang: string | null | undefined): MarimoLanguage {
  if (lang === "python.marimo") return "python";
  if (lang === "sql.marimo") return "sql";
  if (lang === "markdown.marimo") return "markdown";
  if (isSupportedLanguage(lang)) return lang;
  return "python";
}

function isSupportedLanguage(lang: string | null | undefined): lang is MarimoLanguage {
  return lang === "python" || lang === "sql" || lang === "markdown";
}

function metaTokens(meta: string): string[] {
  const tokens: string[] = [];
  const pattern = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;
  for (const match of meta.matchAll(pattern)) tokens.push(match[0]);
  return tokens;
}
