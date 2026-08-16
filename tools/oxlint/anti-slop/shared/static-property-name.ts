import type { ESTree } from "@oxlint/plugins";

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

/** Return the source-level name of a statically known property key. */
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
