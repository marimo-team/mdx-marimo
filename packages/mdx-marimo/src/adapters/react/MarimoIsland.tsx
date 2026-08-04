"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { mountMarimoIsland } from "@marimo-team/mdx-marimo/bridge/browser";
import type { MarimoPageCellPayload } from "@marimo-team/mdx-marimo/bridge/protocol";
import { mdxMarimoHost } from "../../element/name";

export type MarimoIslandTheme = "auto" | "light" | "dark";

export type MarimoIslandStyle = CSSProperties & {
  [key: `--marimo-island-${string}`]: string | number | undefined;
};

export type MarimoIslandProps = {
  payload: MarimoPageCellPayload;
  className?: string;
  style?: MarimoIslandStyle;
  theme?: MarimoIslandTheme;
};

export function MarimoIsland({ payload, className, style, theme = "auto" }: MarimoIslandProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    return mountMarimoIsland(host, payload, { host: mdxMarimoHost, theme });
  }, [payload, theme]);

  const islandClassName = ["marimo-island-host", className].filter(Boolean).join(" ");

  return (
    <div
      key={`${payload.app?.id ?? "static"}:${payload.cell.index}`}
      ref={ref}
      className={islandClassName}
      style={style}
      data-marimo-host={mdxMarimoHost}
      data-marimo-theme-mode={theme}
      data-marimo-app-id={payload.app?.id}
      data-marimo-cell-index={payload.cell.index}
    />
  );
}
