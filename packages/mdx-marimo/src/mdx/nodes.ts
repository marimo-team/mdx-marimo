import { Parser } from "acorn";
import type { Program } from "estree";
import type { RootContent } from "mdast";
import type { MarimoPageCellPayload } from "@marimo-team/islands-bridge/protocol";
import { defaultMarimoElementName } from "../element/name";

export function sideEffectImportNode(importSource: string): RootContent {
  const value = `import ${JSON.stringify(importSource)}`;
  return {
    type: "mdxjsEsm",
    value,
    data: {
      estree: Parser.parse(value, {
        ecmaVersion: "latest",
        sourceType: "module",
      }) as unknown as Program,
    },
  } as unknown as RootContent;
}

export function marimoIslandNode({
  elementName = defaultMarimoElementName,
  payload,
  theme = "auto",
}: {
  elementName?: string;
  payload: MarimoPageCellPayload;
  theme?: "auto" | "light" | "dark";
}): RootContent {
  return {
    type: "mdxJsxFlowElement",
    name: elementName,
    attributes: [
      {
        type: "mdxJsxAttribute",
        name: "class",
        value: "marimo-island-host",
      },
      {
        type: "mdxJsxAttribute",
        name: "data-marimo-host",
        value: "mdx",
      },
      {
        type: "mdxJsxAttribute",
        name: "data-marimo-theme-mode",
        value: theme,
      },
      {
        type: "mdxJsxAttribute",
        name: "data-marimo-app-id",
        value: payload.app?.id ?? "",
      },
      {
        type: "mdxJsxAttribute",
        name: "data-marimo-cell-index",
        value: String(payload.cell.index),
      },
      {
        type: "mdxJsxAttribute",
        name: "data-marimo-payload-encoding",
        value: "base64url",
      },
      {
        type: "mdxJsxAttribute",
        name: "data-marimo-payload",
        value: encodePayload(payload),
      },
    ],
    children: [],
    data: {
      _mdxExplicitJsx: true,
    },
  } as unknown as RootContent;
}

function encodePayload(payload: MarimoPageCellPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}
