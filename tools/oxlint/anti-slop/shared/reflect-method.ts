import type { ESTree, SourceCode } from "@oxlint/plugins";

import { resolveValueVariable } from "./scope.ts";
import { staticPropertyName } from "./static-property-name.ts";

function isGlobalReflect(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
  if (expression.type !== "Identifier" || expression.name !== "Reflect") return false;
  if (sourceCode.isGlobalReference(expression)) return true;
  const variable = resolveValueVariable(sourceCode, expression);
  return variable === null || variable.defs.length === 0;
}

/** Reports whether a call target names one method on the global Reflect object. */
export function isGlobalReflectMethodCall(
  sourceCode: SourceCode,
  callee: ESTree.Expression,
  methodName: string,
): boolean {
  const unwrapped = callee.type === "ChainExpression" ? callee.expression : callee;
  if (!("property" in unwrapped) || !("object" in unwrapped) || !("computed" in unwrapped)) {
    return false;
  }
  if (!isGlobalReflect(sourceCode, unwrapped.object)) return false;
  return staticPropertyName(unwrapped.property, unwrapped.computed) === methodName;
}
