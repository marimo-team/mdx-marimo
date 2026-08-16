import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

import {
  isGlobalTypeReference,
  resolveTypeAliasApplication,
  resolveTypeSubstitution,
  type TypeSubstitutions,
} from "../shared/scope.ts";

type FunctionWithReturnType =
  | ESTree.ArrowFunctionExpression
  | ESTree.Function
  | ESTree.TSCallSignatureDeclaration
  | ESTree.TSConstructSignatureDeclaration
  | ESTree.TSConstructorType
  | ESTree.TSFunctionType
  | ESTree.TSMethodSignature;

/** Ban function contracts that return unknown instead of a parsed domain type. */
export const noUnknownReturnsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow functions whose explicit return contract is unknown or Promise<unknown>.",
    },
    messages: {
      unknownReturn:
        "This function exposes `unknown` to its caller. Parse the value at its boundary and return a named domain type.",
    },
  },
  createOnce(context) {
    const resolvesToUnknown = (
      type: ESTree.TSType,
      substitutions: TypeSubstitutions = new Map(),
      visited = new Set<ESTree.TSTypeAliasDeclaration>(),
      resolvingParameters = new Set<ESTree.TSTypeParameter>(),
    ): boolean => {
      if (type.type === "TSUnknownKeyword") return true;
      if (type.type === "TSParenthesizedType") {
        return resolvesToUnknown(type.typeAnnotation, substitutions, visited, resolvingParameters);
      }
      if (type.type === "TSUnionType") {
        return type.types.some((member) =>
          resolvesToUnknown(member, substitutions, visited, resolvingParameters),
        );
      }
      if (type.type !== "TSTypeReference") return false;
      const substitution = resolveTypeSubstitution(context.sourceCode, type, substitutions);
      if (substitution !== null) {
        if (resolvingParameters.has(substitution.parameter)) return false;
        const nextResolving = new Set(resolvingParameters);
        nextResolving.add(substitution.parameter);
        return resolvesToUnknown(substitution.type, substitutions, visited, nextResolving);
      }
      if (
        isGlobalTypeReference(context.sourceCode, type, "Promise") ||
        isGlobalTypeReference(context.sourceCode, type, "PromiseLike")
      ) {
        const value = type.typeArguments?.params[0];
        return (
          value !== undefined &&
          resolvesToUnknown(value, substitutions, visited, resolvingParameters)
        );
      }
      const application = resolveTypeAliasApplication(context.sourceCode, type, substitutions);
      if (application === null || visited.has(application.alias)) {
        return false;
      }
      const nextVisited = new Set(visited);
      nextVisited.add(application.alias);
      return resolvesToUnknown(
        application.alias.typeAnnotation,
        application.substitutions,
        nextVisited,
        resolvingParameters,
      );
    };

    const checkReturnType = (node: FunctionWithReturnType) => {
      const annotation = node.returnType;
      if (annotation === null || annotation === undefined) return;
      if (!resolvesToUnknown(annotation.typeAnnotation)) return;
      context.report({ node: annotation.typeAnnotation, messageId: "unknownReturn" });
    };

    return {
      ArrowFunctionExpression: checkReturnType,
      FunctionDeclaration: checkReturnType,
      FunctionExpression: checkReturnType,
      TSCallSignatureDeclaration: checkReturnType,
      TSConstructSignatureDeclaration: checkReturnType,
      TSConstructorType: checkReturnType,
      TSDeclareFunction: checkReturnType,
      TSEmptyBodyFunctionExpression: checkReturnType,
      TSFunctionType: checkReturnType,
      TSMethodSignature: checkReturnType,
    };
  },
});
