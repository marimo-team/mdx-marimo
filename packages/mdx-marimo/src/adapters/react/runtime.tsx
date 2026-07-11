"use client";

import { useEffect } from "react";
import { defineMarimoIslandElement } from "../../element";

export type MarimoIslandRuntimeProps = {
  elementName?: string;
};

export function MarimoIslandRuntime({ elementName }: MarimoIslandRuntimeProps) {
  useEffect(() => {
    // Let React finish hydrating deferred MDX boundaries before the custom
    // element mounts output into their child DOM.
    const frame = window.requestAnimationFrame(() => {
      defineMarimoIslandElement(elementName);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [elementName]);

  return null;
}
