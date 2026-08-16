import { Parser } from "acorn";
import type { Program } from "estree";
import type { MdxjsEsm, MdxJsxFlowElement } from "mdast-util-mdx";
import {
  encodePageCellPayload,
  type MarimoPageSerializedCellPayload,
} from "@marimo-team/mdx-marimo/bridge/protocol";
import { defaultMarimoElementName, mdxMarimoHost } from "../element/name";

export type MarimoIslandNodeOptions = {
  elementName?: string;
  payload: MarimoPageSerializedCellPayload;
  theme?: "auto" | "light" | "dark";
};

type MarimoMdxJsxFlowElement = MdxJsxFlowElement & {
  data: NonNullable<MdxJsxFlowElement["data"]> & {
    _mdxExplicitJsx: true;
  };
};

export function sideEffectImportNode(importSource: string): MdxjsEsm {
  const value = `import ${JSON.stringify(importSource)}`;
  const parsed = Parser.parse(value, {
    ecmaVersion: "latest",
    sourceType: "module",
  });
  // SAFETY: Acorn returns an ESTree program for the configured module grammar.
  const estree = parsed as Program;
  return {
    type: "mdxjsEsm",
    value,
    data: {
      estree,
    },
  };
}

export function marimoIslandNode({
  elementName = defaultMarimoElementName,
  payload,
  theme = "auto",
}: MarimoIslandNodeOptions): MdxJsxFlowElement {
  const node: MarimoMdxJsxFlowElement = {
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
        value: mdxMarimoHost,
      },
      {
        type: "mdxJsxAttribute",
        name: "data-marimo-theme-mode",
        value: theme,
      },
      {
        type: "mdxJsxAttribute",
        name: "data-marimo-app-id",
        value: "app" in payload ? (payload.app?.id ?? "") : payload.appId,
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
        value: encodePageCellPayload(payload),
      },
    ],
    children: [],
    data: {
      _mdxExplicitJsx: true,
    },
  };
  return node;
}
