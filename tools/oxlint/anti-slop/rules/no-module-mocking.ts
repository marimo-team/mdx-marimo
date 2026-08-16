import { defineRule } from "@oxlint/plugins";

import type { ESTree, SourceCode } from "@oxlint/plugins";

import { resolveValueVariable } from "../shared/scope.ts";
import { staticPropertyName } from "../shared/static-property-name.ts";
import {
  isGlobalValueReference,
  unwrapTransparentExpression,
} from "../shared/value-reference.ts";

const moduleMockMethods = new Set(["doMock", "mock", "unstable_mockModule"]);

function importedName(node: ESTree.Node): string | null {
  if (node.type !== "ImportSpecifier") return null;
  return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
}

function isSupportedFrameworkExport(source: string, name: string | null): boolean {
  return (
    ((source === "vitest" || source === "vite-plus/test") && name === "vi") ||
    (source === "@jest/globals" && name === "jest")
  );
}

function isImportedTestFrameworkObject(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
): boolean {
  const unwrapped = unwrapTransparentExpression(expression);
  const directImport = unwrapped.type === "Identifier";
  const namespaceExport = directImport
    ? null
    : "property" in unwrapped && "object" in unwrapped && "computed" in unwrapped
      ? staticPropertyName(unwrapped.property, unwrapped.computed)
      : null;
  const namespaceObject =
    !directImport && namespaceExport !== null && "object" in unwrapped
      ? unwrapped.object
      : null;
  const unwrappedNamespaceObject =
    namespaceObject === null || namespaceObject.type === "Super"
      ? null
      : unwrapTransparentExpression(namespaceObject);
  const binding = directImport
    ? unwrapped
    : unwrappedNamespaceObject?.type === "Identifier"
      ? unwrappedNamespaceObject
      : null;
  if (binding === null) return false;
  const variable = resolveValueVariable(sourceCode, binding);
  if (variable === null) return false;
  return variable.defs.some((definition) => {
    if (definition.type !== "ImportBinding" || definition.parent?.type !== "ImportDeclaration") {
      return false;
    }
    const source = definition.parent.source.value;
    const name = directImport
      ? importedName(definition.node)
      : definition.node.type === "ImportNamespaceSpecifier"
        ? namespaceExport
        : null;
    return isSupportedFrameworkExport(source, name);
  });
}

function isTestFrameworkObject(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
  return (
    isGlobalValueReference(sourceCode, expression, "vi") ||
    isGlobalValueReference(sourceCode, expression, "jest") ||
    isImportedTestFrameworkObject(sourceCode, expression)
  );
}

function moduleMockCall(sourceCode: SourceCode, callee: ESTree.Expression): boolean {
  const unwrapped = unwrapTransparentExpression(callee);
  if (!("property" in unwrapped) || !("object" in unwrapped) || !("computed" in unwrapped)) {
    return false;
  }
  if (!isTestFrameworkObject(sourceCode, unwrapped.object)) return false;
  const method = staticPropertyName(unwrapped.property, unwrapped.computed);
  return method !== null && moduleMockMethods.has(method);
}

/** Ban test framework module mocking in favor of real dependency seams. */
export const noModuleMockingRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Vitest and Jest module mocking; tests must replace dependencies through real interfaces.",
    },
    messages: {
      moduleMock:
        "Replace module mocking with dependency injection through a real interface, service layer, or faithful test implementation.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression") return;
        if (moduleMockCall(context.sourceCode, node.callee)) {
          context.report({ node, messageId: "moduleMock" });
        }
      },
    };
  },
});
