import { defineRule } from "@oxlint/plugins";

import type { ESTree, SourceCode } from "@oxlint/plugins";

import { resolveValueVariable } from "../shared/scope.ts";
import { staticPropertyName } from "../shared/static-property-name.ts";

const moduleMockMethods = new Set(["doMock", "mock", "unstable_mockModule"]);

function importedName(node: ESTree.Node): string | null {
  if (node.type !== "ImportSpecifier") return null;
  return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
}

function isTestFrameworkObject(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
): expression is ESTree.IdentifierReference {
  if (expression.type !== "Identifier") return false;
  if (
    (expression.name === "vi" || expression.name === "jest") &&
    sourceCode.isGlobalReference(expression)
  ) {
    return true;
  }

  const variable = resolveValueVariable(sourceCode, expression);
  if (variable === null || variable.defs.length === 0) {
    return expression.name === "vi" || expression.name === "jest";
  }
  return variable.defs.some((definition) => {
    if (definition.type !== "ImportBinding" || definition.parent?.type !== "ImportDeclaration") {
      return false;
    }
    const source = definition.parent.source.value;
    const name = importedName(definition.node);
    return (
      ((source === "vitest" || source === "vite-plus/test") && name === "vi") ||
      (source === "@jest/globals" && name === "jest")
    );
  });
}

function moduleMockCall(sourceCode: SourceCode, callee: ESTree.Expression): boolean {
  const unwrapped = callee.type === "ChainExpression" ? callee.expression : callee;
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
