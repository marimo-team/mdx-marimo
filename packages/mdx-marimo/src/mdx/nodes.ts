import { Parser } from "acorn";
import { valueToEstree } from "estree-util-value-to-estree";
import type { Program } from "estree";
import type { RootContent } from "mdast";
import { defaultMarimoElementName } from "../element/name";
import type { MarimoOutput } from "../schema";

type ImportNodeOptions = {
  componentName: string;
  importName: string | undefined;
  importSource: string;
};

export function importNode({
  componentName,
  importName,
  importSource,
}: ImportNodeOptions): RootContent {
  const importedName = importName ?? componentName;
  const specifier =
    importedName === componentName ? importedName : `${importedName} as ${componentName}`;
  const value = `import { ${specifier} } from ${JSON.stringify(importSource)}`;
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

export function marimoComponentNode(componentName: string, output: MarimoOutput): RootContent {
  return {
    type: "mdxJsxFlowElement",
    name: componentName,
    attributes: [
      {
        type: "mdxJsxAttribute",
        name: "key",
        value: islandKey(output),
      },
      {
        type: "mdxJsxAttribute",
        name: "output",
        value: {
          type: "mdxJsxAttributeValueExpression",
          value: JSON.stringify(output),
          data: {
            estree: {
              type: "Program",
              sourceType: "module",
              body: [
                {
                  type: "ExpressionStatement",
                  expression: valueToEstree(output),
                },
              ],
            },
          },
        },
      },
    ],
    children: [],
    data: {
      _mdxExplicitJsx: true,
    },
  } as unknown as RootContent;
}

export function marimoElementNode({
  elementName = defaultMarimoElementName,
  output,
  theme = "auto",
}: {
  elementName?: string;
  output: MarimoOutput;
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
        value: output.appId,
      },
      {
        type: "mdxJsxAttribute",
        name: "data-marimo-cell-index",
        value: String(output.cellIndex),
      },
      {
        type: "mdxJsxAttribute",
        name: "data-marimo-output",
        value: JSON.stringify(output),
      },
    ],
    children: [],
    data: {
      _mdxExplicitJsx: true,
    },
  } as unknown as RootContent;
}

function islandKey(output: MarimoOutput): string {
  if (!isRecord(output)) return "marimo-island";
  const appId = typeof output.appId === "string" ? output.appId : "app";
  const cellIndex = typeof output.cellIndex === "number" ? output.cellIndex : "cell";
  return `${appId}:${cellIndex}`;
}

function isRecord(value: MarimoOutput): value is MarimoOutput {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
