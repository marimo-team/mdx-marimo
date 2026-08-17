import type { ESTree, SourceCode, Variable } from "@oxlint/plugins";

import {
  isGlobalThisValue,
  resolveValueVariable,
  stableConstOrigin,
  staticMemberName,
  unwrapValueExpression,
} from "./value-reference.ts";

const functionInvocationMethods = new Set(["apply", "call"]);
const functionBindingMethods = new Set(["bind"]);

function isGlobalReflect(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
  visitedVariables: ReadonlySet<Variable>,
): boolean {
  const identifier = unwrapValueExpression(expression);
  if (identifier.type === "MemberExpression") {
    return (
      staticMemberName(identifier) === "Reflect" &&
      isGlobalThisValue(sourceCode, identifier.object, visitedVariables)
    );
  }
  if (identifier.type !== "Identifier") return false;
  if (identifier.name === "Reflect" && sourceCode.isGlobalReference(identifier)) return true;
  const variable = resolveValueVariable(sourceCode, identifier);
  if (variable === null || variable.defs.length === 0) return identifier.name === "Reflect";
  if (visitedVariables.has(variable)) return false;

  const binding = stableConstOrigin(variable);
  if (binding === null) return false;
  const nextVisited = new Set(visitedVariables);
  nextVisited.add(variable);
  if (binding.kind === "expression") {
    return isGlobalReflect(sourceCode, binding.expression, nextVisited);
  }
  return (
    binding.property === "Reflect" && isGlobalThisValue(sourceCode, binding.object, nextVisited)
  );
}

function isGlobalReflectMethodValue(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
  methodName: string,
  visitedVariables: ReadonlySet<Variable>,
): boolean {
  const unwrapped = unwrapValueExpression(expression);
  if (unwrapped.type === "MemberExpression") {
    return (
      staticMemberName(unwrapped) === methodName &&
      isGlobalReflect(sourceCode, unwrapped.object, visitedVariables)
    );
  }
  if (unwrapped.type === "CallExpression") {
    return (
      unwrapped.callee.type !== "Super" &&
      unwrapped.callee.type !== "V8IntrinsicExpression" &&
      isGlobalReflectMethodAdapter(
        sourceCode,
        unwrapped.callee,
        methodName,
        functionBindingMethods,
        visitedVariables,
      )
    );
  }
  if (unwrapped.type !== "Identifier") return false;

  const variable = resolveValueVariable(sourceCode, unwrapped);
  if (variable === null || visitedVariables.has(variable)) return false;
  const binding = stableConstOrigin(variable);
  if (binding === null) return false;
  const nextVisited = new Set(visitedVariables);
  nextVisited.add(variable);
  if (binding.kind === "expression") {
    return isGlobalReflectMethodValue(sourceCode, binding.expression, methodName, nextVisited);
  }
  return (
    binding.property === methodName && isGlobalReflect(sourceCode, binding.object, nextVisited)
  );
}

function isGlobalReflectMethodAdapter(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
  methodName: string,
  adapters: ReadonlySet<string>,
  visitedVariables: ReadonlySet<Variable>,
): boolean {
  const unwrapped = unwrapValueExpression(expression);
  if (unwrapped.type !== "MemberExpression") return false;
  const adapter = staticMemberName(unwrapped);
  return (
    adapter !== null &&
    adapters.has(adapter) &&
    isGlobalReflectMethodValue(sourceCode, unwrapped.object, methodName, visitedVariables)
  );
}

/** Reports whether a call target names one method on the global Reflect object. */
export function isGlobalReflectMethodCall(
  sourceCode: SourceCode,
  callee: ESTree.Expression,
  methodName: string,
): boolean {
  return (
    isGlobalReflectMethodValue(sourceCode, callee, methodName, new Set()) ||
    isGlobalReflectMethodAdapter(
      sourceCode,
      callee,
      methodName,
      functionInvocationMethods,
      new Set(),
    )
  );
}
