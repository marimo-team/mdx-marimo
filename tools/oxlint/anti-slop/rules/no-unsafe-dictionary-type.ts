import type { ESTree } from "@oxlint/plugins";

import { defineRule } from "@oxlint/plugins";

import {
  classifyUnsafeDictionary,
  classifyUnsafeDictionaryValue,
} from "../shared/dictionary-types.ts";
import {
  createLexicalTypeEnvironment,
  resolveTypeReference,
  type LexicalTypeEnvironment,
} from "../shared/type-environment.ts";

const typeNodeKinds: ReadonlySet<string> = new Set([
  "JSDocNonNullableType",
  "JSDocNullableType",
  "JSDocUnknownType",
  "TSAnyKeyword",
  "TSArrayType",
  "TSBigIntKeyword",
  "TSBooleanKeyword",
  "TSConditionalType",
  "TSConstructorType",
  "TSFunctionType",
  "TSImportType",
  "TSIndexedAccessType",
  "TSInferType",
  "TSIntersectionType",
  "TSIntrinsicKeyword",
  "TSLiteralType",
  "TSMappedType",
  "TSNamedTupleMember",
  "TSNeverKeyword",
  "TSNullKeyword",
  "TSNumberKeyword",
  "TSObjectKeyword",
  "TSParenthesizedType",
  "TSStringKeyword",
  "TSSymbolKeyword",
  "TSTemplateLiteralType",
  "TSThisType",
  "TSTupleType",
  "TSTypeLiteral",
  "TSTypeOperator",
  "TSTypePredicate",
  "TSTypeQuery",
  "TSTypeReference",
  "TSUndefinedKeyword",
  "TSUnionType",
  "TSUnknownKeyword",
  "TSVoidKeyword",
]);

function isTypeNode(node: ESTree.Node): node is ESTree.TSType {
  return typeNodeKinds.has(node.type);
}

function enclosingTypeAliasDeclaration(node: ESTree.Node): ESTree.TSTypeAliasDeclaration | null {
  let current: ESTree.Node | null = node.parent;
  while (current !== null && current.type !== "Program") {
    if (current.type === "TSTypeAliasDeclaration") return current;
    current = current.parent;
  }
  return null;
}

function isAliasConsumerUse(node: ESTree.TSType, environment: LexicalTypeEnvironment): boolean {
  if (node.type !== "TSTypeReference" || node.typeArguments?.params.length) return false;
  const resolved = resolveTypeReference(node, environment);
  const enclosingDeclaration = enclosingTypeAliasDeclaration(node);
  return (
    resolved !== null &&
    resolved.declaration !== null &&
    resolved.declaration !== enclosingDeclaration &&
    (resolved.declaration.typeParameters?.params.length ?? 0) === 0
  );
}

function shouldReportType(node: ESTree.TSType, environment: LexicalTypeEnvironment): boolean {
  if (isAliasConsumerUse(node, environment)) return false;
  if (classifyUnsafeDictionary(node, environment) === null) return false;
  let current: ESTree.Node | null = node.parent;
  while (current !== null && current.type !== "Program") {
    if (isTypeNode(current) && classifyUnsafeDictionary(current, environment) !== null)
      return false;
    current = current.parent;
  }
  return true;
}

/** Disallow object-dictionary contracts whose direct value type is an unsafe escape hatch. */
export const noUnsafeDictionaryTypeRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow object-dictionary contracts whose direct value type is unknown, any, object, {}, or a union/alias containing one of those escape hatches.",
    },
    messages: {
      unsafeDictionary:
        "This dictionary's {{value}} value type gives callers no concrete value contract. Use an owner/schema-derived value type; parse external payloads before insertion.",
    },
  },
  createOnce(context) {
    let environment: LexicalTypeEnvironment | null = null;
    const report = (node: ESTree.Node, value: string) => {
      context.report({ node, messageId: "unsafeDictionary", data: { value } });
    };
    const reportIfUnsafe = (node: ESTree.TSType) => {
      if (environment === null || !shouldReportType(node, environment)) return;
      const unsafe = classifyUnsafeDictionary(node, environment);
      if (unsafe === null) return;
      report(node, unsafe.unsafeValue);
    };

    return {
      Program(node) {
        environment = createLexicalTypeEnvironment(node, context.sourceCode.visitorKeys);
      },
      TSTypeReference: reportIfUnsafe,
      TSTypeLiteral: reportIfUnsafe,
      TSMappedType: reportIfUnsafe,
      TSIndexSignature(node) {
        if (
          environment === null ||
          node.typeAnnotation === null ||
          node.parent.type === "TSTypeLiteral"
        )
          return;
        const unsafe = classifyUnsafeDictionaryValue(
          node.typeAnnotation.typeAnnotation,
          environment,
        );
        if (unsafe !== null) report(node, unsafe.unsafeValue);
      },
    };
  },
});
