import type { Parent } from "mdast";
import {
  projectPageCellPayloads,
  type CompiledMarimoPage,
  type MarimoDiagnostic,
  type MarimoPageSerializedCellPayload,
} from "@marimo-team/mdx-marimo/bridge/protocol";
import { marimoIslandNode, type MarimoIslandNodeOptions } from "../mdx/nodes";

export type ParentNode = Parent;

export type MessageFile = {
  message(reason: string, place?: { line: number; column: number }): void;
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
  const payloads = projectPageCellPayloads(result);

  for (const edit of edits.slice().reverse()) {
    if (edit.type === "remove") {
      edit.parent.children.splice(edit.index, 1);
      continue;
    }
    const payload = payloads[edit.outputIndex];
    if (!payload) {
      edit.parent.children.splice(edit.index, 1);
      continue;
    }
    const node = marimoIslandNode(islandNodeOptions(outputMode, payload));
    edit.parent.children.splice(edit.index, 1, node);
    didReplace = true;
  }

  return didReplace;
}

function islandNodeOptions(
  outputMode: MarimoTreeEditOutput,
  payload: MarimoPageSerializedCellPayload,
): MarimoIslandNodeOptions {
  const options: MarimoIslandNodeOptions = { payload };
  if (outputMode.elementName !== undefined) options.elementName = outputMode.elementName;
  if (outputMode.theme !== undefined) options.theme = outputMode.theme;
  return options;
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
