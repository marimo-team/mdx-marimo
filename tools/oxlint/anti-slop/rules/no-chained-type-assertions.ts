import type { ESTree, Scope, SourceCode, Variable } from "@oxlint/plugins";

import { defineRule } from "@oxlint/plugins";

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

function unwrapTransparentExpression(expression: ESTree.Expression): ESTree.Expression {
  let current = expression;
  while (isTransparentExpression(current)) {
    current = current.expression;
  }
  return current;
}

function resolveVariable(
  sourceCode: SourceCode,
  identifier: ESTree.IdentifierReference,
): Variable | null {
  let scope: Scope | null = sourceCode.getScope(identifier);
  while (scope !== null) {
    const variable = scope.set.get(identifier.name);
    if (variable !== undefined) return variable;
    scope = scope.upper;
  }
  return null;
}

function stableConstInitializer(variable: Variable): ESTree.Expression | null {
  if (variable.defs.length !== 1) return null;
  const [definition] = variable.defs;
  if (definition?.type !== "Variable" || definition.node.type !== "VariableDeclarator") {
    return null;
  }
  const declarator = definition.node;
  if (
    declarator.id.type !== "Identifier" ||
    declarator.init === null ||
    declarator.parent.type !== "VariableDeclaration" ||
    declarator.parent.kind !== "const" ||
    variable.references.some((reference) => !reference.init && reference.isWrite())
  ) {
    return null;
  }
  return declarator.init;
}

function hasForbiddenAssertionPath(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
  assertionCount: number,
  hasNonConstAssertion: boolean,
  visitedVariables: ReadonlySet<Variable>,
): boolean {
  const current = unwrapTransparentExpression(expression);
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

  const variable = resolveVariable(sourceCode, current);
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
