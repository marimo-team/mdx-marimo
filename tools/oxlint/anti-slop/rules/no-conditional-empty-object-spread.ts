import type { ESTree, Scope, SourceCode, Variable } from "@oxlint/plugins";

import { defineRule } from "@oxlint/plugins";

function unwrapTransparentExpression(node: ESTree.Expression): ESTree.Expression {
  let current = node;
  while (
    current.type === "ParenthesizedExpression" ||
    current.type === "TSAsExpression" ||
    current.type === "TSSatisfiesExpression" ||
    current.type === "TSTypeAssertion" ||
    current.type === "TSNonNullExpression"
  ) {
    current = current.expression;
  }
  return current;
}

function isEmptyObjectExpression(node: ESTree.Expression): boolean {
  const expression = unwrapTransparentExpression(node);
  return expression.type === "ObjectExpression" && expression.properties.length === 0;
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

function hasEmptyObjectConditionalArm(
  sourceCode: SourceCode,
  node: ESTree.Expression,
  visitedVariables: ReadonlySet<Variable>,
): boolean {
  const expression = unwrapTransparentExpression(node);
  if (isEmptyObjectExpression(expression)) return true;
  if (expression.type === "Identifier") {
    const variable = resolveVariable(sourceCode, expression);
    if (variable === null || visitedVariables.has(variable)) return false;
    const initializer = stableConstInitializer(variable);
    if (initializer === null) return false;
    return hasEmptyObjectConditionalArm(
      sourceCode,
      initializer,
      new Set([...visitedVariables, variable]),
    );
  }
  return (
    expression.type === "ConditionalExpression" &&
    (hasEmptyObjectConditionalArm(sourceCode, expression.consequent, visitedVariables) ||
      hasEmptyObjectConditionalArm(sourceCode, expression.alternate, visitedVariables))
  );
}

function isConditionalEmptyObjectSpread(
  sourceCode: SourceCode,
  node: ESTree.Expression,
  visitedVariables: ReadonlySet<Variable> = new Set(),
): boolean {
  const conditional = unwrapTransparentExpression(node);
  if (conditional.type === "Identifier") {
    const variable = resolveVariable(sourceCode, conditional);
    if (variable === null || visitedVariables.has(variable)) return false;
    const initializer = stableConstInitializer(variable);
    if (initializer === null) return false;
    return isConditionalEmptyObjectSpread(
      sourceCode,
      initializer,
      new Set([...visitedVariables, variable]),
    );
  }
  return (
    conditional.type === "ConditionalExpression" &&
    (hasEmptyObjectConditionalArm(sourceCode, conditional.consequent, visitedVariables) ||
      hasEmptyObjectConditionalArm(sourceCode, conditional.alternate, visitedVariables))
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

        if (isConditionalEmptyObjectSpread(context.sourceCode, node.argument)) {
          context.report({ node, messageId: "avoid" });
        }
      },
    };
  },
});
