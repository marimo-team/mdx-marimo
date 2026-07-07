import type { RootContent } from "mdast";
import { marimoComponentNode, marimoElementNode } from "../mdx/nodes";
import type { MarimoDiagnostic, MarimoPageResult } from "../schema";

export type ParentNode = {
  children: RootContent[];
};

export type MessageFile = {
  message: (reason: string, place?: { line: number; column: number }) => unknown;
};

export type TreeEdit =
  | { type: "remove"; parent: ParentNode; index: number }
  | { type: "replace"; parent: ParentNode; index: number; outputIndex: number };

export type MarimoTreeEditOutput =
  | {
      type: "element";
      elementName?: string;
      theme?: "auto" | "light" | "dark";
    }
  | {
      type: "component";
      componentName: string;
    };

export function applyTreeEdits(
  edits: TreeEdit[],
  result: MarimoPageResult,
  outputMode: MarimoTreeEditOutput,
): boolean {
  let didReplace = false;

  for (const edit of edits.slice().reverse()) {
    if (edit.type === "remove") {
      edit.parent.children.splice(edit.index, 1);
      continue;
    }
    const cellOutput = result.outputs[edit.outputIndex]!;
    const node =
      outputMode.type === "component"
        ? marimoComponentNode(outputMode.componentName, cellOutput)
        : marimoElementNode(elementNodeOptions(outputMode, cellOutput));
    edit.parent.children.splice(edit.index, 1, node);
    didReplace = true;
  }

  return didReplace;
}

function elementNodeOptions(
  outputMode: Extract<MarimoTreeEditOutput, { type: "element" }>,
  cellOutput: MarimoPageResult["outputs"][number],
): Parameters<typeof marimoElementNode>[0] {
  return {
    ...(outputMode.elementName === undefined ? {} : { elementName: outputMode.elementName }),
    ...(outputMode.theme === undefined ? {} : { theme: outputMode.theme }),
    output: cellOutput,
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
