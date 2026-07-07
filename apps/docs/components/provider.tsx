"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import { useEffect, type ReactNode } from "react";

export function Provider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void import("@marimo-team/mdx-marimo/element/auto");
  }, []);

  return <RootProvider>{children}</RootProvider>;
}
