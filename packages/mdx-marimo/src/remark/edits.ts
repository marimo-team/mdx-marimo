import type { RootContent } from "mdast";
import {
  pageCellPayload,
  type CompiledMarimoCell,
  type CompiledMarimoPage,
  type MarimoDiagnostic,
} from "@marimo-team/islands-bridge/protocol";
import { marimoIslandNode } from "../mdx/nodes";

export type ParentNode = {
  children: RootContent[];
};

export type MessageFile = {
  message: (reason: string, place?: { line: number; column: number }) => unknown;
};

export type TreeEdit =
  | { type: "remove"; parent: ParentNode; index: number }
  | { type: "replace"; parent: ParentNode; index: number; outputIndex: number };

export type MarimoTreeEditOutput = {
  elementName?: string;
  theme?: "auto" | "light" | "dark";
};

export function applyTreeEdits(
  edits: TreeEdit[],
  result: CompiledMarimoPage,
  outputMode: MarimoTreeEditOutput,
): boolean {
  let didReplace = false;

  for (const edit of edits.slice().reverse()) {
    if (edit.type === "remove") {
      edit.parent.children.splice(edit.index, 1);
      continue;
    }
    const cell = result.cells[edit.outputIndex]!;
    const node = marimoIslandNode(islandNodeOptions(outputMode, result, cell));
    edit.parent.children.splice(edit.index, 1, node);
    didReplace = true;
  }

  return didReplace;
}

function islandNodeOptions(
  outputMode: MarimoTreeEditOutput,
  result: CompiledMarimoPage,
  cell: CompiledMarimoCell,
): Parameters<typeof marimoIslandNode>[0] {
  return {
    ...(outputMode.elementName === undefined ? {} : { elementName: outputMode.elementName }),
    ...(outputMode.theme === undefined ? {} : { theme: outputMode.theme }),
    payload: pageCellPayload(result, cell),
  };
}

export function reportDiagnostic(file: MessageFile, diagnostic: MarimoDiagnostic): void {
  file.message(
    diagnostic.message,
    diagnostic.line ? { line: diagnostic.line, column: 1 } : undefined,
  );
}

export function withOptionalLine(
  diagnostic: Omit<MarimoDiagnostic, "line">,
  line: number | undefined,
): MarimoDiagnostic {
  return line === undefined ? diagnostic : { ...diagnostic, line };
}
