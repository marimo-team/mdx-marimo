import type { ESTree, SourceCode, Variable } from "@oxlint/plugins";

import { defineRule } from "@oxlint/plugins";

import {
  resolveValueVariable,
  stableConstInitializer,
  unwrapValueExpression,
} from "../shared/value-reference.ts";

type TypeAssertionExpression = ESTree.TSAsExpression | ESTree.TSTypeAssertion;
type TransparentExpression =
  | ESTree.ParenthesizedExpression
  | ESTree.TSNonNullExpression
  | ESTree.TSSatisfiesExpression;

function isTypeAssertionExpression(node: ESTree.Node): node is TypeAssertionExpression {
  return node.type === "TSAsExpression" || node.type === "TSTypeAssertion";
}

function isTransparentExpression(node: ESTree.Node): node is TransparentExpression {
  return (
    node.type === "ParenthesizedExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSNonNullExpression"
  );
}

function hasForbiddenAssertionPath(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
  assertionCount: number,
  hasNonConstAssertion: boolean,
  visitedVariables: ReadonlySet<Variable>,
): boolean {
  const current = unwrapValueExpression(expression, { assertions: false, chain: false });
  if (isTypeAssertionExpression(current)) {
    const nextCount = assertionCount + 1;
    const nextHasNonConst = hasNonConstAssertion || !isConstAssertion(current);
    return (
      (nextCount > 1 && nextHasNonConst) ||
      hasForbiddenAssertionPath(
        sourceCode,
        current.expression,
        nextCount,
        nextHasNonConst,
        visitedVariables,
      )
    );
  }
  if (current.type === "SequenceExpression") {
    const finalExpression = current.expressions.at(-1);
    return (
      finalExpression !== undefined &&
      hasForbiddenAssertionPath(
        sourceCode,
        finalExpression,
        assertionCount,
        hasNonConstAssertion,
        visitedVariables,
      )
    );
  }
  if (current.type === "ConditionalExpression") {
    return (
      hasForbiddenAssertionPath(
        sourceCode,
        current.consequent,
        assertionCount,
        hasNonConstAssertion,
        visitedVariables,
      ) ||
      hasForbiddenAssertionPath(
        sourceCode,
        current.alternate,
        assertionCount,
        hasNonConstAssertion,
        visitedVariables,
      )
    );
  }
  if (current.type === "LogicalExpression") {
    return (
      hasForbiddenAssertionPath(
        sourceCode,
        current.left,
        assertionCount,
        hasNonConstAssertion,
        visitedVariables,
      ) ||
      hasForbiddenAssertionPath(
        sourceCode,
        current.right,
        assertionCount,
        hasNonConstAssertion,
        visitedVariables,
      )
    );
  }
  if (current.type !== "Identifier") return false;

  const variable = resolveValueVariable(sourceCode, current);
  if (variable === null || visitedVariables.has(variable)) return false;
  const initializer = stableConstInitializer(variable);
  return (
    initializer !== null &&
    hasForbiddenAssertionPath(
      sourceCode,
      initializer,
      assertionCount,
      hasNonConstAssertion,
      new Set([...visitedVariables, variable]),
    )
  );
}

function isConstAssertion(node: TypeAssertionExpression): boolean {
  const { typeAnnotation } = node;
  return (
    typeAnnotation.type === "TSTypeReference" &&
    typeAnnotation.typeName.type === "Identifier" &&
    typeAnnotation.typeName.name === "const"
  );
}

function isOutermostAssertionInChain(node: TypeAssertionExpression): boolean {
  let current: ESTree.Expression = node;
  let parent = node.parent;

  while (isTransparentExpression(parent) && parent.expression === current) {
    current = parent;
    parent = parent.parent;
  }

  return !isTypeAssertionExpression(parent) || parent.expression !== current;
}

function isForbiddenAssertionChain(sourceCode: SourceCode, node: TypeAssertionExpression): boolean {
  return hasForbiddenAssertionPath(sourceCode, node, 0, false, new Set());
}

/** Disallow nested TypeScript type assertions, while permitting chains made only of const assertions. */
export const noChainedTypeAssertionsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow chained TypeScript as and angle-bracket assertions, including parenthesized chains.",
    },
    messages: {
      chained:
        "This assertion chain discards type evidence. Keep the original precise type, or parse untrusted input at its boundary before narrowing it.",
    },
  },
  createOnce(context) {
    const checkTypeAssertion = (node: TypeAssertionExpression) => {
      if (
        !isOutermostAssertionInChain(node) ||
        !isForbiddenAssertionChain(context.sourceCode, node)
      ) {
        return;
      }
      context.report({ node, messageId: "chained" });
    };

    return {
      TSAsExpression: checkTypeAssertion,
      TSTypeAssertion: checkTypeAssertion,
    };
  },
});
