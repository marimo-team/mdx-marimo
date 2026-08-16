import type { ESTree, SourceCode } from "@oxlint/plugins";

import { staticPropertyName } from "./static-property-name.ts";
import { isGlobalValueReference, unwrapTransparentExpression } from "./value-reference.ts";

/** Reports whether a call target names one method on the global Reflect object. */
export function isGlobalReflectMethodCall(
  sourceCode: SourceCode,
  callee: ESTree.Expression,
  methodName: string,
): boolean {
  const unwrapped = unwrapTransparentExpression(callee);
  if (!("property" in unwrapped) || !("object" in unwrapped) || !("computed" in unwrapped)) {
    return false;
  }
  if (!isGlobalValueReference(sourceCode, unwrapped.object, "Reflect")) return false;
  return staticPropertyName(unwrapped.property, unwrapped.computed) === methodName;
}
