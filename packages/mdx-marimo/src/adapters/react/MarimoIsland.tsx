"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { mountMarimoIsland } from "../../browser";
import type { MarimoOutput } from "../../schema";

export type MarimoIslandTheme = "auto" | "light" | "dark";

export type MarimoIslandStyle = CSSProperties & {
  [key: `--marimo-island-${string}`]: string | number | undefined;
};

export type MarimoIslandProps = {
  output: MarimoOutput;
  className?: string;
  style?: MarimoIslandStyle;
  theme?: MarimoIslandTheme;
};

export function MarimoIsland({ output, className, style, theme = "auto" }: MarimoIslandProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    return mountMarimoIsland(host, output, { theme });
  }, [output, theme]);

  const islandClassName = ["marimo-island-host", className].filter(Boolean).join(" ");

  return (
    <div
      key={`${output.appId}:${output.cellIndex}`}
      ref={ref}
      className={islandClassName}
      style={style}
      data-marimo-host="mdx"
      data-marimo-theme-mode={theme}
      data-marimo-app-id={output.appId}
      data-marimo-cell-index={output.cellIndex}
    />
  );
}
