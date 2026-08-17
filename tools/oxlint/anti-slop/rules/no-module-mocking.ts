import type { ESTree, SourceCode, Variable } from "@oxlint/plugins";

import { defineRule } from "@oxlint/plugins";

import {
  isGlobalThisValue,
  isUnshadowedGlobalIdentifier,
  resolveValueVariable,
  stableConstOrigin,
  staticMemberName,
  unwrapValueExpression,
} from "../shared/value-reference.ts";

const moduleMockMethods = new Set(["doMock", "mock", "unstable_mockModule"]);
const functionInvocationMethods = new Set(["apply", "call"]);
const functionBindingMethods = new Set(["bind"]);
const vitestModules = new Set(["vite-plus/test", "vitest"]);

function importedName(node: ESTree.Node): string | null {
  if (node.type !== "ImportSpecifier") return null;
  return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
}

function frameworkExport(source: string, name: string | null): boolean {
  return (
    (name === "vi" && vitestModules.has(source)) || (source === "@jest/globals" && name === "jest")
  );
}

function frameworkImport(variable: Variable): boolean {
  return variable.defs.some((definition) => {
    if (definition.type !== "ImportBinding" || definition.parent?.type !== "ImportDeclaration") {
      return false;
    }
    return frameworkExport(definition.parent.source.value, importedName(definition.node));
  });
}

function namespaceImportSource(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
  visitedVariables: ReadonlySet<Variable>,
): string | null {
  const identifier = unwrapValueExpression(expression);
  if (identifier.type !== "Identifier") return null;
  const variable = resolveValueVariable(sourceCode, identifier);
  if (variable === null || visitedVariables.has(variable)) return null;

  for (const definition of variable.defs) {
    if (
      definition.type === "ImportBinding" &&
      definition.node.type === "ImportNamespaceSpecifier" &&
      definition.parent?.type === "ImportDeclaration"
    ) {
      return definition.parent.source.value;
    }
  }

  const binding = stableConstOrigin(variable);
  if (binding === null || binding.kind !== "expression") return null;
  const nextVisited = new Set(visitedVariables);
  nextVisited.add(variable);
  return namespaceImportSource(sourceCode, binding.expression, nextVisited);
}

function isGlobalTestFrameworkObject(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
  visitedVariables: ReadonlySet<Variable>,
): boolean {
  const unwrapped = unwrapValueExpression(expression);
  if (unwrapped.type === "Identifier") {
    return (
      isUnshadowedGlobalIdentifier(sourceCode, unwrapped, "vi") ||
      isUnshadowedGlobalIdentifier(sourceCode, unwrapped, "jest")
    );
  }
  if (unwrapped.type !== "MemberExpression") return false;
  const name = staticMemberName(unwrapped);
  return (
    (name === "vi" || name === "jest") &&
    unwrapped.object.type !== "Super" &&
    isGlobalThisValue(sourceCode, unwrapped.object, visitedVariables)
  );
}

function isTestFrameworkObject(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
  visitedVariables: ReadonlySet<Variable> = new Set(),
): boolean {
  const unwrapped = unwrapValueExpression(expression);
  if (isGlobalTestFrameworkObject(sourceCode, unwrapped, visitedVariables)) return true;
  if (unwrapped.type === "MemberExpression") {
    const name = staticMemberName(unwrapped);
    if (name === null) return false;
    const source = namespaceImportSource(sourceCode, unwrapped.object, visitedVariables);
    return source !== null && frameworkExport(source, name);
  }
  if (unwrapped.type !== "Identifier") return false;

  const variable = resolveValueVariable(sourceCode, unwrapped);
  if (variable === null || variable.defs.length === 0) return false;
  if (frameworkImport(variable)) return true;
  if (visitedVariables.has(variable)) return false;

  const binding = stableConstOrigin(variable);
  if (binding === null) return false;
  const nextVisited = new Set(visitedVariables);
  nextVisited.add(variable);
  if (binding.kind === "expression") {
    return isTestFrameworkObject(sourceCode, binding.expression, nextVisited);
  }
  const source = namespaceImportSource(sourceCode, binding.object, nextVisited);
  return source !== null && frameworkExport(source, binding.property);
}

function isModuleMockMethodValue(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
  visitedVariables: ReadonlySet<Variable> = new Set(),
): boolean {
  const unwrapped = unwrapValueExpression(expression);
  if (unwrapped.type === "MemberExpression") {
    const method = staticMemberName(unwrapped);
    return (
      method !== null &&
      moduleMockMethods.has(method) &&
      isTestFrameworkObject(sourceCode, unwrapped.object, visitedVariables)
    );
  }
  if (unwrapped.type === "CallExpression") {
    return (
      unwrapped.callee.type !== "Super" &&
      unwrapped.callee.type !== "V8IntrinsicExpression" &&
      isModuleMockMethodAdapter(
        sourceCode,
        unwrapped.callee,
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
    return isModuleMockMethodValue(sourceCode, binding.expression, nextVisited);
  }
  return (
    moduleMockMethods.has(binding.property) &&
    isTestFrameworkObject(sourceCode, binding.object, nextVisited)
  );
}

function isModuleMockMethodAdapter(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
  adapters: ReadonlySet<string>,
  visitedVariables: ReadonlySet<Variable>,
): boolean {
  const unwrapped = unwrapValueExpression(expression);
  if (unwrapped.type !== "MemberExpression") return false;
  const adapter = staticMemberName(unwrapped);
  return (
    adapter !== null &&
    adapters.has(adapter) &&
    isModuleMockMethodValue(sourceCode, unwrapped.object, visitedVariables)
  );
}

function isModuleMockInvocation(sourceCode: SourceCode, callee: ESTree.Expression): boolean {
  return (
    isModuleMockMethodValue(sourceCode, callee) ||
    isModuleMockMethodAdapter(sourceCode, callee, functionInvocationMethods, new Set())
  );
}

/** Ban test framework module mocking in favor of real dependency seams. */
export const noModuleMockingRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Vitest and Jest module mocking; tests must replace dependencies through real interfaces.",
    },
    messages: {
      moduleMock:
        "Replace module mocking with dependency injection through a real interface, service layer, or faithful test implementation.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression") return;
        if (isModuleMockInvocation(context.sourceCode, node.callee)) {
          context.report({ node, messageId: "moduleMock" });
        }
      },
    };
  },
});
