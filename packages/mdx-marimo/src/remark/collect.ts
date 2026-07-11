import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import { fenceLanguage, isMarimoConfigFence, isMarimoFence } from "../authoring/fences";
import { parseFenceOptions } from "../authoring/options";
import type { MarimoCellRequest, MarimoDiagnostic } from "@marimo-team/islands-bridge/protocol";
import type { MessageFile, ParentNode, TreeEdit } from "./edits";
import { reportDiagnostic, withOptionalLine } from "./edits";

export type CollectedMarimoPage = {
  cells: MarimoCellRequest[];
  diagnostics: MarimoDiagnostic[];
  edits: TreeEdit[];
  pyproject: string | undefined;
};

export function collectMarimoPage(tree: Root, file: MessageFile): CollectedMarimoPage {
  const cells: MarimoCellRequest[] = [];
  const diagnostics: MarimoDiagnostic[] = [];
  const edits: TreeEdit[] = [];
  let pyproject: string | undefined;
  let configLine: number | undefined;

  visit(tree, "code", (node, index, parent) => {
    if (typeof index !== "number" || !parent || !Array.isArray(parent.children)) return;
    const editParent = parent as ParentNode;
    if (isMarimoConfigFence(node.lang)) {
      if (pyproject === undefined) {
        pyproject = node.value;
        configLine = node.position?.start.line;
      } else {
        reportDiagnostic(
          file,
          withOptionalLine(
            {
              severity: "warning",
              message: `Duplicate marimo-config fence; first config fence is on line ${configLine ?? "unknown"}`,
            },
            node.position?.start.line,
          ),
        );
      }
      edits.push({ type: "remove", parent: editParent, index });
      return;
    }
    if (!isMarimoFence(node.lang, node.meta)) return;

    const language = fenceLanguage(node.lang);
    const parsed = parseFenceOptions(language, node.meta);
    for (const diagnostic of parsed.diagnostics) {
      const withLocation = withOptionalLine(
        {
          ...diagnostic,
          cellIndex: cells.length,
        },
        node.position?.start.line,
      );
      diagnostics.push(withLocation);
      reportDiagnostic(file, withLocation);
    }
    const cell: MarimoCellRequest = {
      index: cells.length,
      source: node.value,
      options: parsed.options,
    };
    if (node.position?.start.line !== undefined) cell.startLine = node.position.start.line;
    if (node.position?.end.line !== undefined) cell.endLine = node.position.end.line;
    cells.push(cell);
    edits.push({ type: "replace", parent: editParent, index, outputIndex: cell.index });
  });

  return { cells, diagnostics, edits, pyproject };
}
