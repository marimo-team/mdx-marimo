import type { ESTree, SourceCode } from "@oxlint/plugins";

import { resolveValueVariable } from "./scope.ts";
import { staticPropertyName } from "./static-property-name.ts";

/** Remove syntax wrappers that preserve an expression's runtime value. */
export function unwrapTransparentExpression(expression: ESTree.Expression): ESTree.Expression {
  let current = expression;
  while (
    current.type === "ChainExpression" ||
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

function isUnshadowedGlobalIdentifier(
  sourceCode: SourceCode,
  identifier: ESTree.IdentifierReference,
  name: string,
): boolean {
  if (identifier.name !== name) return false;
  if (sourceCode.isGlobalReference(identifier)) return true;
  const variable = resolveValueVariable(sourceCode, identifier);
  return variable === null || variable.defs.length === 0;
}

/** Match a global value through its identifier or the built-in globalThis object. */
export function isGlobalValueReference(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
  name: string,
): boolean {
  const unwrapped = unwrapTransparentExpression(expression);
  if (unwrapped.type === "Identifier") {
    return isUnshadowedGlobalIdentifier(sourceCode, unwrapped, name);
  }
  if (!("property" in unwrapped) || !("object" in unwrapped) || !("computed" in unwrapped)) {
    return false;
  }
  if (staticPropertyName(unwrapped.property, unwrapped.computed) !== name) return false;
  if (unwrapped.object.type === "Super") return false;
  const object = unwrapTransparentExpression(unwrapped.object);
  return (
    object.type === "Identifier" &&
    isUnshadowedGlobalIdentifier(sourceCode, object, "globalThis")
  );
}
