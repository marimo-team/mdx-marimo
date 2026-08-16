import { defineRule } from "@oxlint/plugins";

import type { ESTree, SourceCode } from "@oxlint/plugins";

type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion;

const commentOwnerKinds = new Set([
  "DoWhileStatement",
  "ExpressionStatement",
  "ExportDefaultDeclaration",
  "ForInStatement",
  "ForOfStatement",
  "ForStatement",
  "IfStatement",
  "LabeledStatement",
  "MethodDefinition",
  "PropertyDefinition",
  "ReturnStatement",
  "SwitchStatement",
  "SwitchCase",
  "TSEnumMember",
  "TSExportAssignment",
  "ThrowStatement",
  "TryStatement",
  "VariableDeclaration",
  "WhileStatement",
  "WithStatement",
]);

const enclosingDeclarationKinds = new Set([
  "ArrowFunctionExpression",
  "ClassDeclaration",
  "ClassExpression",
  "FunctionDeclaration",
  "FunctionExpression",
  "TSEmptyBodyFunctionExpression",
  "TSEnumDeclaration",
]);

function isTransparentExpressionParent(parent: ESTree.Node, child: ESTree.Node): boolean {
  return (
    (parent.type === "ParenthesizedExpression" ||
      parent.type === "TSAsExpression" ||
      parent.type === "TSNonNullExpression" ||
      parent.type === "TSSatisfiesExpression" ||
      parent.type === "TSTypeAssertion") &&
    parent.expression === child
  );
}

function isImmediatelyInvokedFunctionBody(node: ESTree.Node, descendant: ESTree.Node): boolean {
  if (node.type !== "ArrowFunctionExpression" && node.type !== "FunctionExpression") return false;
  if (node.body !== descendant) return false;
  let callee: ESTree.Node = node;
  while (true) {
    const parent: ESTree.Node | null = callee.parent;
    if (parent === null || !isTransparentExpressionParent(parent, callee)) break;
    callee = parent;
  }
  const parent: ESTree.Node | null = callee.parent;
  return parent !== null && parent.type === "CallExpression" && parent.callee === callee;
}

function isConstAssertion(node: TypeAssertion): boolean {
  return (
    node.typeAnnotation.type === "TSTypeReference" &&
    node.typeAnnotation.typeName.type === "Identifier" &&
    node.typeAnnotation.typeName.name === "const"
  );
}

function hasSafetyComment(sourceCode: SourceCode, node: TypeAssertion): boolean {
  let descendant: ESTree.Node = node;
  let current: ESTree.Node = node;
  while (true) {
    if (
      current !== node &&
      enclosingDeclarationKinds.has(current.type) &&
      !isImmediatelyInvokedFunctionBody(current, descendant)
    ) {
      return false;
    }
    if (
      sourceCode
        .getCommentsBefore(current)
        .some((comment) => comment.end <= node.start && /\bSAFETY\s*:/u.test(comment.value))
    ) {
      return true;
    }
    if (commentOwnerKinds.has(current.type) || current.parent.type === "Program") return false;
    descendant = current;
    current = current.parent;
  }
}

/** Require every non-const type assertion to state the invariant TypeScript cannot express. */
export const requireSafetyCommentForTypeAssertionRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a nearby SAFETY comment for every TypeScript type assertion except const assertions.",
    },
    messages: {
      missingSafetyComment:
        "This type assertion has no `SAFETY:` justification. State the checked invariant immediately before the assertion or its containing statement.",
    },
  },
  createOnce(context) {
    const checkAssertion = (node: TypeAssertion) => {
      if (isConstAssertion(node) || hasSafetyComment(context.sourceCode, node)) return;
      context.report({ node, messageId: "missingSafetyComment" });
    };

    return {
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion,
    };
  },
});
