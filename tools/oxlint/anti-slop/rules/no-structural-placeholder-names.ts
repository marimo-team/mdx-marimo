import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

import { resolveValueVariable } from "../shared/scope.ts";
import { staticPropertyName } from "../shared/static-property-name.ts";

const FORBIDDEN_SYMBOL_NAME = "shape";

type ParameterOwner =
  | ESTree.ArrowFunctionExpression
  | ESTree.Function
  | ESTree.TSCallSignatureDeclaration
  | ESTree.TSConstructSignatureDeclaration
  | ESTree.TSConstructorType
  | ESTree.TSFunctionType
  | ESTree.TSMethodSignature;

function containsForbiddenSymbolName(name: string): boolean {
  return name.toLowerCase().includes(FORBIDDEN_SYMBOL_NAME);
}

/** Report broad structural names where the declaration can be renamed locally. */
export const noStructuralPlaceholderNamesRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        'Disallow the case-insensitive substring "shape" in JavaScript and TypeScript declaration names.',
    },
    messages: {
      forbiddenSymbolName:
        'Rename symbol "{{name}}" for its domain role; "shape" describes structure rather than ownership.',
    },
  },
  createOnce(context) {
    const reportForbiddenName = (node: ESTree.Node, name: string): void => {
      if (!containsForbiddenSymbolName(name)) return;
      context.report({
        node,
        messageId: "forbiddenSymbolName",
        data: { name },
      });
    };

    const reportForbiddenSymbolName = (node: ESTree.Node & { name: string }): void => {
      reportForbiddenName(node, node.name);
    };

    const reportBinding = (binding: ESTree.BindingPattern | ESTree.ParamPattern): void => {
      if (binding.type === "Identifier") {
        reportForbiddenSymbolName(binding);
        return;
      }
      if (binding.type === "AssignmentPattern") {
        reportBinding(binding.left);
        return;
      }
      if (binding.type === "RestElement") {
        reportBinding(binding.argument);
        return;
      }
      if (binding.type === "TSParameterProperty") {
        reportBinding(binding.parameter);
        return;
      }
      if (binding.type === "ArrayPattern") {
        for (const element of binding.elements) {
          if (element !== null) reportBinding(element);
        }
        return;
      }
      for (const property of binding.properties) {
        reportBinding(property.type === "RestElement" ? property.argument : property.value);
      }
    };

    const reportParameters = (node: ParameterOwner): void => {
      for (const parameter of node.params) reportBinding(parameter);
    };

    const reportFunction = (node: ESTree.Function): void => {
      if (node.id !== null) reportForbiddenSymbolName(node.id);
      reportParameters(node);
    };

    const reportClass = (node: ESTree.Class): void => {
      if (node.id !== null) reportForbiddenSymbolName(node.id);
    };

    const reportPropertyKey = (key: ESTree.PropertyKey, computed: boolean): void => {
      const name = staticPropertyName(key, computed);
      if (name !== null) reportForbiddenName(key, name);
    };

    const reportClassElement = (
      node: ESTree.AccessorProperty | ESTree.MethodDefinition | ESTree.PropertyDefinition,
    ): void => {
      reportPropertyKey(node.key, node.computed);
    };

    return {
      AccessorProperty: reportClassElement,
      ArrowFunctionExpression: reportParameters,
      CatchClause(node) {
        if (node.param !== null) reportBinding(node.param);
      },
      ClassDeclaration: reportClass,
      ClassExpression: reportClass,
      FunctionDeclaration: reportFunction,
      FunctionExpression: reportFunction,
      ImportDefaultSpecifier(node) {
        reportForbiddenSymbolName(node.local);
      },
      ImportNamespaceSpecifier(node) {
        reportForbiddenSymbolName(node.local);
      },
      ImportSpecifier(node) {
        reportForbiddenSymbolName(node.local);
      },
      MethodDefinition: reportClassElement,
      Property(node) {
        if (node.parent?.type !== "ObjectExpression") return;
        if (node.shorthand && node.key.type === "Identifier") {
          const variable = resolveValueVariable(context.sourceCode, node.key);
          if (variable !== null && variable.defs.length > 0) return;
        }
        reportPropertyKey(node.key, node.computed);
      },
      PropertyDefinition: reportClassElement,
      TSAbstractAccessorProperty: reportClassElement,
      TSAbstractMethodDefinition: reportClassElement,
      TSAbstractPropertyDefinition: reportClassElement,
      TSCallSignatureDeclaration: reportParameters,
      TSConstructSignatureDeclaration: reportParameters,
      TSConstructorType: reportParameters,
      TSDeclareFunction: reportFunction,
      TSEmptyBodyFunctionExpression: reportFunction,
      TSEnumDeclaration(node) {
        reportForbiddenSymbolName(node.id);
      },
      TSEnumMember(node) {
        reportPropertyKey(node.id, node.computed);
      },
      TSFunctionType: reportParameters,
      TSIndexSignature(node) {
        for (const parameter of node.parameters) reportForbiddenSymbolName(parameter);
      },
      TSInterfaceDeclaration(node) {
        reportForbiddenSymbolName(node.id);
      },
      TSMappedType(node) {
        reportForbiddenSymbolName(node.key);
      },
      TSMethodSignature(node) {
        reportPropertyKey(node.key, node.computed);
        reportParameters(node);
      },
      TSModuleDeclaration(node) {
        if (node.id.type === "Identifier") reportForbiddenSymbolName(node.id);
      },
      TSPropertySignature(node) {
        reportPropertyKey(node.key, node.computed);
      },
      TSTypeAliasDeclaration(node) {
        reportForbiddenSymbolName(node.id);
      },
      TSTypeParameter(node) {
        reportForbiddenSymbolName(node.name);
      },
      VariableDeclarator(node) {
        reportBinding(node.id);
      },
    };
  },
});
