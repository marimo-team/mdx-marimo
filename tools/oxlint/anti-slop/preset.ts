import type { AntiSlopRuleName } from "./index.ts";

import { antiSlopPluginRules } from "./index.ts";

export const antiSlopIgnorePatterns = [
  ".agent/**",
  ".agents/**",
  ".claude/**",
  ".codex/**",
  ".continue/**",
  ".cursor/**",
  ".gemini/**",
  ".opencode/**",
  ".pi/**",
  ".roo/**",
  ".windsurf/**",
  "tools/oxlint/anti-slop/**",
] as const;

export const antiSlopRules = Object.fromEntries(
  (Object.keys(antiSlopPluginRules) as AntiSlopRuleName[]).map((name) => [
    `anti-slop/${name}`,
    "error" as const,
  ]),
) as Readonly<Record<`anti-slop/${AntiSlopRuleName}`, "error">>;
