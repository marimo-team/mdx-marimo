import type { ESTree, Reference, Scope, SourceCode, Variable } from "@oxlint/plugins";

export type StableConstOrigin =
  | { kind: "expression"; expression: ESTree.Expression }
  | { kind: "property"; object: ESTree.Expression; property: string };

export function sameValueIdentifier(
  left: Reference["identifier"],
  right: ESTree.IdentifierReference,
): boolean {
  return left === right || (left.start === right.start && left.end === right.end);
}

function referenceInScope(scope: Scope, identifier: ESTree.IdentifierReference): Reference | null {
  return (
    scope.references.find((reference) => sameValueIdentifier(reference.identifier, identifier)) ??
    scope.through.find((reference) => sameValueIdentifier(reference.identifier, identifier)) ??
    null
  );
}

export function resolveValueVariable(
  sourceCode: SourceCode,
  identifier: ESTree.IdentifierReference,
): Variable | null {
  let scope: Scope | null = sourceCode.getScope(identifier);
  while (scope !== null) {
    const reference = referenceInScope(scope, identifier);
    if (reference !== null) return reference.resolved;
    scope = scope.upper;
  }
  return null;
}

export function variableDeclarator(variable: Variable): ESTree.VariableDeclarator | null {
  if (variable.defs.length !== 1) return null;
  const [definition] = variable.defs;
  return definition?.type === "Variable" && definition.node.type === "VariableDeclarator"
    ? definition.node
    : null;
}

type ValueUnwrapOptions = {
  readonly assertions?: boolean;
  readonly chain?: boolean;
};

export function unwrapValueExpression(
  expression: ESTree.Expression,
  options: ValueUnwrapOptions = {},
): ESTree.Expression {
  let current = expression;
  while (
    (options.chain !== false && current.type === "ChainExpression") ||
    current.type === "ParenthesizedExpression" ||
    (options.assertions !== false && current.type === "TSAsExpression") ||
    current.type === "TSSatisfiesExpression" ||
    (options.assertions !== false && current.type === "TSTypeAssertion") ||
    current.type === "TSNonNullExpression"
  ) {
    current = current.expression;
  }
  return current;
}

function unwrapPropertyKey(key: ESTree.PropertyKey): ESTree.PropertyKey {
  let current = key;
  while (
    current.type === "ParenthesizedExpression" ||
    current.type === "TSAsExpression" ||
    current.type === "TSNonNullExpression" ||
    current.type === "TSSatisfiesExpression" ||
    current.type === "TSTypeAssertion"
  ) {
    current = current.expression;
  }
  return current;
}

export function staticPropertyName(key: ESTree.PropertyKey, computed: boolean): string | null {
  const unwrapped = unwrapPropertyKey(key);
  if (!computed && (unwrapped.type === "Identifier" || unwrapped.type === "PrivateIdentifier")) {
    return unwrapped.name;
  }
  if (unwrapped.type === "Literal" && typeof unwrapped.value === "string") {
    return unwrapped.value;
  }
  if (unwrapped.type === "TemplateLiteral" && unwrapped.expressions.length === 0) {
    const quasi = unwrapped.quasis[0];
    return quasi === undefined ? null : (quasi.value.cooked ?? quasi.value.raw);
  }
  return null;
}

export function staticMemberName(expression: ESTree.Expression): string | null {
  const unwrapped = unwrapValueExpression(expression);
  return unwrapped.type === "MemberExpression"
    ? staticPropertyName(unwrapped.property, unwrapped.computed)
    : null;
}

export function isUnshadowedGlobalIdentifier(
  sourceCode: SourceCode,
  identifier: ESTree.IdentifierReference,
  name: string,
): boolean {
  if (identifier.name !== name) return false;
  const variable = resolveValueVariable(sourceCode, identifier);
  if (variable !== null && variable.defs.length > 0) return false;
  return sourceCode.isGlobalReference(identifier) || variable === null;
}

export function stableConstOrigin(variable: Variable): StableConstOrigin | null {
  const declarator = variableDeclarator(variable);
  if (
    declarator === null ||
    declarator.init === null ||
    declarator.parent.type !== "VariableDeclaration" ||
    declarator.parent.kind !== "const" ||
    variable.references.some((reference) => reference.isWrite() && !reference.init)
  ) {
    return null;
  }
  if (declarator.id.type === "Identifier") {
    return declarator.id.name === variable.name
      ? { kind: "expression", expression: declarator.init }
      : null;
  }
  if (declarator.id.type !== "ObjectPattern") return null;

  for (const property of declarator.id.properties) {
    if (
      property.type !== "Property" ||
      property.value.type !== "Identifier" ||
      property.value.name !== variable.name
    ) {
      continue;
    }
    const name = staticPropertyName(property.key, property.computed);
    return name === null ? null : { kind: "property", object: declarator.init, property: name };
  }
  return null;
}

export function stableConstInitializer(variable: Variable): ESTree.Expression | null {
  const origin = stableConstOrigin(variable);
  return origin?.kind === "expression" ? origin.expression : null;
}

export function isGlobalThisValue(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
  visitedVariables: ReadonlySet<Variable>,
): boolean {
  const unwrapped = unwrapValueExpression(expression);
  if (unwrapped.type !== "Identifier") return false;
  if (isUnshadowedGlobalIdentifier(sourceCode, unwrapped, "globalThis")) return true;

  const variable = resolveValueVariable(sourceCode, unwrapped);
  if (variable === null || visitedVariables.has(variable)) return false;
  const initializer = stableConstInitializer(variable);
  if (initializer === null) return false;
  const nextVisited = new Set(visitedVariables);
  nextVisited.add(variable);
  return isGlobalThisValue(sourceCode, initializer, nextVisited);
}
