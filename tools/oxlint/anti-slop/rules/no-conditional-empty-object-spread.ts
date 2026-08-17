import type { ESTree, Reference, SourceCode, Variable } from "@oxlint/plugins";

import { defineRule } from "@oxlint/plugins";

import {
  resolveValueVariable,
  sameValueIdentifier,
  stableConstInitializer,
  unwrapValueExpression,
} from "../shared/value-reference.ts";

function isEmptyObjectExpression(node: ESTree.Expression): boolean {
  const expression = unwrapValueExpression(node);
  return expression.type === "ObjectExpression" && expression.properties.length === 0;
}

function executionBoundary(node: ESTree.Node): ESTree.Node | null {
  let current: ESTree.Node | null = node;
  while (current !== null) {
    if (
      current.type === "Program" ||
      current.type === "ArrowFunctionExpression" ||
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression"
    ) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function outerTransparentValue(node: ESTree.Node): ESTree.Node {
  let current = node;
  let parent = current.parent;
  while (
    parent !== null &&
    (parent.type === "ChainExpression" ||
      parent.type === "ParenthesizedExpression" ||
      parent.type === "TSAsExpression" ||
      parent.type === "TSSatisfiesExpression" ||
      parent.type === "TSTypeAssertion" ||
      parent.type === "TSNonNullExpression") &&
    parent.expression === current
  ) {
    current = parent;
    parent = current.parent;
  }
  return current;
}

function isObjectSpreadRead(identifier: Reference["identifier"]): boolean {
  const expression = outerTransparentValue(identifier);
  return (
    expression.parent !== null &&
    expression.parent.type === "SpreadElement" &&
    expression.parent.argument === expression &&
    expression.parent.parent.type === "ObjectExpression"
  );
}

function hasStableObjectState(
  variable: Variable,
  currentUse: ESTree.IdentifierReference,
  finalUse: ESTree.SpreadElement,
): boolean {
  const targetBoundary = executionBoundary(finalUse);
  for (const reference of variable.references) {
    if (reference.init || sameValueIdentifier(reference.identifier, currentUse)) continue;

    const identifier = reference.identifier;
    const sameBoundary = executionBoundary(identifier) === targetBoundary;
    if (sameBoundary && identifier.start >= finalUse.start) continue;
    if (isObjectSpreadRead(identifier)) continue;
    return false;
  }
  return true;
}

function stableInitializerAtUse(
  sourceCode: SourceCode,
  identifier: ESTree.IdentifierReference,
  finalUse: ESTree.SpreadElement,
): { initializer: ESTree.Expression; variable: Variable } | null {
  const variable = resolveValueVariable(sourceCode, identifier);
  if (variable === null || !hasStableObjectState(variable, identifier, finalUse)) return null;
  const initializer = stableConstInitializer(variable);
  return initializer === null ? null : { initializer, variable };
}

function hasEmptyObjectConditionalArm(
  sourceCode: SourceCode,
  node: ESTree.Expression,
  finalUse: ESTree.SpreadElement,
  visitedVariables: ReadonlySet<Variable>,
): boolean {
  const expression = unwrapValueExpression(node);
  if (isEmptyObjectExpression(expression)) return true;
  if (expression.type === "Identifier") {
    const origin = stableInitializerAtUse(sourceCode, expression, finalUse);
    if (origin === null || visitedVariables.has(origin.variable)) return false;
    return hasEmptyObjectConditionalArm(
      sourceCode,
      origin.initializer,
      finalUse,
      new Set([...visitedVariables, origin.variable]),
    );
  }
  return (
    expression.type === "ConditionalExpression" &&
    (hasEmptyObjectConditionalArm(sourceCode, expression.consequent, finalUse, visitedVariables) ||
      hasEmptyObjectConditionalArm(sourceCode, expression.alternate, finalUse, visitedVariables))
  );
}

function isConditionalEmptyObjectSpread(
  sourceCode: SourceCode,
  node: ESTree.Expression,
  finalUse: ESTree.SpreadElement,
  visitedVariables: ReadonlySet<Variable> = new Set(),
): boolean {
  const conditional = unwrapValueExpression(node);
  if (conditional.type === "Identifier") {
    const origin = stableInitializerAtUse(sourceCode, conditional, finalUse);
    if (origin === null || visitedVariables.has(origin.variable)) return false;
    return isConditionalEmptyObjectSpread(
      sourceCode,
      origin.initializer,
      finalUse,
      new Set([...visitedVariables, origin.variable]),
    );
  }
  return (
    conditional.type === "ConditionalExpression" &&
    (hasEmptyObjectConditionalArm(sourceCode, conditional.consequent, finalUse, visitedVariables) ||
      hasEmptyObjectConditionalArm(sourceCode, conditional.alternate, finalUse, visitedVariables))
  );
}

/** Ban conditional empty-object spreads without changing their omission semantics. */
export const noConditionalEmptyObjectSpreadRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow object spreads that conditionally spread an empty object to omit fields.",
    },
    messages: {
      avoid:
        "This conditional spread hides property omission behind an empty object. Build the object in separate statements and add the property only when present.",
    },
  },
  createOnce(context) {
    return {
      SpreadElement(node) {
        if (node.parent.type !== "ObjectExpression") return;

        if (isConditionalEmptyObjectSpread(context.sourceCode, node.argument, node)) {
          context.report({ node, messageId: "avoid" });
        }
      },
    };
  },
});
