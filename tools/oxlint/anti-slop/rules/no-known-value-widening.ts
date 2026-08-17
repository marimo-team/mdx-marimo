import type { ESTree, SourceCode, Variable } from "@oxlint/plugins";

import { defineRule } from "@oxlint/plugins";

import {
  classifyPromiseResultWideningTarget,
  classifyWideningTarget,
  isKnownEvidenceExpression,
  type WideningTarget,
} from "../shared/dictionary-types.ts";
import {
  createLexicalTypeEnvironment,
  type LexicalTypeEnvironment,
} from "../shared/type-environment.ts";
import {
  resolveValueVariable,
  stableConstInitializer,
  unwrapValueExpression,
  variableDeclarator,
} from "../shared/value-reference.ts";

type FunctionExpression = ESTree.ArrowFunctionExpression | ESTree.Function;
type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion;

function hasKnownEvidence(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
  visitedVariables = new Set<Variable>(),
): boolean {
  if (isKnownEvidenceExpression(expression)) return true;
  const unwrapped = unwrapValueExpression(expression, { chain: false });
  if (unwrapped.type !== "Identifier") return false;
  const variable = resolveValueVariable(sourceCode, unwrapped);
  if (variable === null || visitedVariables.has(variable)) return false;
  const initializer = stableConstInitializer(variable);
  if (initializer === null) return false;
  return hasKnownEvidence(sourceCode, initializer, new Set([...visitedVariables, variable]));
}

function annotationTarget(
  annotation: ESTree.TSTypeAnnotation | null | undefined,
  environment: LexicalTypeEnvironment,
  unwrapPromiseResult = false,
): WideningTarget | null {
  if (annotation === null || annotation === undefined) return null;
  return unwrapPromiseResult
    ? classifyPromiseResultWideningTarget(annotation.typeAnnotation, environment)
    : classifyWideningTarget(annotation.typeAnnotation, environment);
}

function enclosingFunction(node: ESTree.Node): FunctionExpression | null {
  let current: ESTree.Node | null = node.parent;
  while (current !== null && current.type !== "Program") {
    if (
      current.type === "ArrowFunctionExpression" ||
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression"
    ) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function sourceKeyName(sourceCode: SourceCode, key: ESTree.PropertyKey): string {
  if (key.type === "Identifier" || key.type === "PrivateIdentifier") return key.name;
  if (key.type === "Literal") return String(key.value);
  return sourceCode.getText(key);
}

function functionName(sourceCode: SourceCode, owner: FunctionExpression | null): string {
  if (owner === null) return "anonymous function";
  if (owner.id !== null) return owner.id.name;
  const parent = owner.parent;
  if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier")
    return parent.id.name;
  if (parent.type === "MethodDefinition") return sourceKeyName(sourceCode, parent.key);
  return "anonymous function";
}

function isEmptyObjectExpression(expression: ESTree.Expression): boolean {
  const unwrapped = unwrapValueExpression(expression, { chain: false });
  return unwrapped.type === "ObjectExpression" && unwrapped.properties.length === 0;
}

function isDefinitelyEmptyObjectFlow(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
  visitedVariables: ReadonlySet<Variable> = new Set(),
): boolean {
  const unwrapped = unwrapValueExpression(expression, { chain: false });
  if (isEmptyObjectExpression(unwrapped)) return true;
  if (unwrapped.type === "ConditionalExpression") {
    return (
      isDefinitelyEmptyObjectFlow(sourceCode, unwrapped.consequent, visitedVariables) &&
      isDefinitelyEmptyObjectFlow(sourceCode, unwrapped.alternate, visitedVariables)
    );
  }
  if (unwrapped.type === "SequenceExpression") {
    const finalExpression = unwrapped.expressions.at(-1);
    return (
      finalExpression !== undefined &&
      isDefinitelyEmptyObjectFlow(sourceCode, finalExpression, visitedVariables)
    );
  }
  if (unwrapped.type !== "Identifier") return false;
  const variable = resolveValueVariable(sourceCode, unwrapped);
  if (variable === null || visitedVariables.has(variable)) return false;
  const initializer = stableConstInitializer(variable);
  return (
    initializer !== null &&
    isDefinitelyEmptyObjectFlow(sourceCode, initializer, new Set([...visitedVariables, variable]))
  );
}

function isDictionaryAccumulatorTarget(destination: WideningTarget): boolean {
  return destination.kind === "open dictionary" || destination.kind === "generic container";
}

function hasParentAssertion(node: ESTree.Node): boolean {
  return node.parent?.type === "TSAsExpression" || node.parent?.type === "TSTypeAssertion";
}

function bindingPatternAnnotation(
  pattern: ESTree.BindingPattern,
): ESTree.TSTypeAnnotation | null | undefined {
  if (pattern.type === "AssignmentPattern") {
    return bindingPatternAnnotation(pattern.left);
  }
  return pattern.typeAnnotation;
}

function isParameterDefault(node: ESTree.AssignmentPattern): boolean {
  const parent = node.parent;
  if (parent.type === "TSParameterProperty") return parent.parameter === node;
  if (
    parent.type !== "ArrowFunctionExpression" &&
    parent.type !== "FunctionDeclaration" &&
    parent.type !== "FunctionExpression" &&
    parent.type !== "TSDeclareFunction" &&
    parent.type !== "TSEmptyBodyFunctionExpression"
  ) {
    return false;
  }
  return parent.params.some((parameter) => parameter === node);
}

function markAssertionsInFlow(
  expression: ESTree.Expression,
  coveredAssertions: WeakSet<TypeAssertion>,
): void {
  let current = expression;
  while (true) {
    if (current.type === "TSAsExpression" || current.type === "TSTypeAssertion") {
      coveredAssertions.add(current);
      current = current.expression;
      continue;
    }
    if (
      current.type === "ParenthesizedExpression" ||
      current.type === "TSSatisfiesExpression" ||
      current.type === "TSNonNullExpression"
    ) {
      current = current.expression;
      continue;
    }
    if (current.type === "ConditionalExpression") {
      markAssertionsInFlow(current.consequent, coveredAssertions);
      markAssertionsInFlow(current.alternate, coveredAssertions);
      return;
    }
    if (current.type === "SequenceExpression") {
      const finalExpression = current.expressions.at(-1);
      if (finalExpression !== undefined) {
        markAssertionsInFlow(finalExpression, coveredAssertions);
      }
      return;
    }
    return;
  }
}

/** Detect sound syntactic cases where a known value is explicitly widened and loses evidence. */
export const noKnownValueWideningRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow syntactically established values from flowing into explicitly broad or anonymous target types that discard useful evidence.",
    },
    messages: {
      widening:
        "The explicit {{target}} type on {{subject}} discards known type evidence. Keep inference, validate with `satisfies`, or use a named owner contract.",
    },
  },
  createOnce(context) {
    let environment: LexicalTypeEnvironment | null = null;
    const coveredAssertions = new WeakSet<TypeAssertion>();

    const reportFlow = (
      expression: ESTree.Expression,
      destination: WideningTarget | null,
      subject: string,
    ): boolean => {
      if (destination === null) return false;
      const isEmptyObject = isDefinitelyEmptyObjectFlow(context.sourceCode, expression);
      if (destination.kind === "finite dictionary" && !isEmptyObject) {
        return false;
      }
      if (isDictionaryAccumulatorTarget(destination) && isEmptyObject) {
        return false;
      }
      if (!hasKnownEvidence(context.sourceCode, expression)) return false;
      context.report({
        node: expression,
        messageId: "widening",
        data: { subject, target: destination.kind },
      });
      return true;
    };

    const reportAnnotatedFlow = (
      expression: ESTree.Expression,
      destination: WideningTarget | null,
      subject: string,
    ) => {
      if (!reportFlow(expression, destination, subject)) return;
      markAssertionsInFlow(expression, coveredAssertions);
    };

    const targetFromAnnotation = (
      annotation: ESTree.TSTypeAnnotation | null | undefined,
      unwrapPromiseResult = false,
    ) =>
      environment === null ? null : annotationTarget(annotation, environment, unwrapPromiseResult);

    return {
      Program(node) {
        environment = createLexicalTypeEnvironment(node, context.sourceCode.visitorKeys);
      },
      AssignmentPattern(node) {
        if (!isParameterDefault(node)) return;
        reportAnnotatedFlow(
          node.right,
          targetFromAnnotation(bindingPatternAnnotation(node.left)),
          "default parameter",
        );
      },
      VariableDeclarator(node) {
        if (
          node.init === null ||
          (node.id.type !== "Identifier" &&
            node.id.type !== "ObjectPattern" &&
            node.id.type !== "ArrayPattern")
        ) {
          return;
        }
        const subject =
          node.id.type === "Identifier" ? `binding \`${node.id.name}\`` : "binding pattern";
        reportAnnotatedFlow(node.init, targetFromAnnotation(node.id.typeAnnotation), subject);
      },
      PropertyDefinition(node) {
        if (node.value === null) return;
        reportAnnotatedFlow(
          node.value,
          targetFromAnnotation(node.typeAnnotation),
          `property \`${sourceKeyName(context.sourceCode, node.key)}\``,
        );
      },
      AccessorProperty(node) {
        if (node.value === null) return;
        reportAnnotatedFlow(
          node.value,
          targetFromAnnotation(node.typeAnnotation),
          `property \`${sourceKeyName(context.sourceCode, node.key)}\``,
        );
      },
      AssignmentExpression(node) {
        if (node.operator !== "=" || node.left.type !== "Identifier") return;
        const variable = resolveValueVariable(context.sourceCode, node.left);
        if (variable === null) return;
        const declarator = variableDeclarator(variable);
        if (declarator === null || declarator.id.type !== "Identifier") return;
        reportAnnotatedFlow(
          node.right,
          targetFromAnnotation(declarator.id.typeAnnotation),
          `binding \`${declarator.id.name}\``,
        );
      },
      ReturnStatement(node) {
        if (node.argument === null) return;
        const owner = enclosingFunction(node);
        reportAnnotatedFlow(
          node.argument,
          targetFromAnnotation(owner?.returnType, owner?.async === true),
          `return value of \`${functionName(context.sourceCode, owner)}\``,
        );
      },
      ArrowFunctionExpression(node) {
        if (node.body.type === "BlockStatement") return;
        reportAnnotatedFlow(
          node.body,
          targetFromAnnotation(node.returnType, node.async),
          `return value of \`${functionName(context.sourceCode, node)}\``,
        );
      },
      TSAsExpression(node) {
        if (environment === null || hasParentAssertion(node) || coveredAssertions.has(node)) {
          return;
        }
        reportFlow(
          node.expression,
          classifyWideningTarget(node.typeAnnotation, environment),
          "assertion",
        );
      },
      TSTypeAssertion(node) {
        if (environment === null || hasParentAssertion(node) || coveredAssertions.has(node)) {
          return;
        }
        reportFlow(
          node.expression,
          classifyWideningTarget(node.typeAnnotation, environment),
          "assertion",
        );
      },
    };
  },
});
