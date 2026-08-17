import type { ESTree } from "@oxlint/plugins";

import { defineRule } from "@oxlint/plugins";

type RuntimeFunction = ESTree.ArrowFunctionExpression | ESTree.Function;

function isRuntimeFunction(node: ESTree.Node): node is RuntimeFunction {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression"
  );
}

function isInsideExplicitTypeGuard(node: ESTree.Node): boolean {
  let current: ESTree.Node | null = node.parent;
  while (current !== null && current.type !== "Program") {
    if (isRuntimeFunction(current)) {
      if (current.returnType?.typeAnnotation.type === "TSTypePredicate") return true;
    }
    current = current.parent;
  }
  return false;
}

/** Disallow runtime typeof checks that narrow unparsed values instead of decoding them. */
export const noRuntimeTypeofRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow runtime typeof checks. External values must be decoded into meaningful types at their I/O boundary. The configured exception applies to functions with an explicit type-predicate return annotation.",
    },
    messages: {
      runtimeTypeof:
        "A `typeof` check narrows a representation without establishing its contract. Parse input at its I/O boundary, then branch on the domain value.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowInTypeGuards: {
            type: "boolean",
            description:
              "Allow typeof inside functions with an explicit type-predicate return annotation.",
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allowInTypeGuards: false }],
  },
  createOnce(context) {
    return {
      UnaryExpression(node) {
        const option = context.options?.[0];
        const allowInTypeGuards =
          typeof option === "object" &&
          option !== null &&
          !Array.isArray(option) &&
          option.allowInTypeGuards === true;
        if (
          node.operator === "typeof" &&
          (!allowInTypeGuards || !isInsideExplicitTypeGuard(node))
        ) {
          context.report({ node, messageId: "runtimeTypeof" });
        }
      },
    };
  },
});
