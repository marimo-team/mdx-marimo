import type { ESTree, Variable } from "@oxlint/plugins";

import { defineRule } from "@oxlint/plugins";

import {
  createLexicalTypeEnvironment,
  qualifiedNameParts,
  resolveTypeReference,
  type LexicalTypeEnvironment,
  type TypeSubstitutions,
} from "../shared/type-environment.ts";

type BroadTypeKind = "open-record" | "top" | "object" | "record";

type KnownValueEvidence = {
  readonly type: ESTree.TSType | null;
};

const EMPTY_SUBSTITUTIONS: TypeSubstitutions = new Map();

const functionBoundaryTypes = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
  "TSDeclareFunction",
  "TSEmptyBodyFunctionExpression",
]);

function unwrapExpressionParentheses(expression: ESTree.Expression): ESTree.Expression {
  let current = expression;
  while (current.type === "ParenthesizedExpression") current = current.expression;
  return current;
}

function unwrapTypeParentheses(type: ESTree.TSType): ESTree.TSType {
  let current = type;
  while (current.type === "TSParenthesizedType") current = current.typeAnnotation;
  return current;
}

function typeReferenceName(type: ESTree.TSTypeReference): string | null {
  return type.typeName.type === "Identifier" ? type.typeName.name : null;
}

function expressionNameParts(expression: ESTree.Expression): readonly string[] | null {
  if (expression.type === "Identifier") return [expression.name];
  if (
    expression.type !== "MemberExpression" ||
    expression.computed ||
    expression.property.type !== "Identifier"
  ) {
    return null;
  }
  const owner = expressionNameParts(expression.object);
  return owner === null ? null : [...owner, expression.property.name];
}

function interfaceDeclarations(
  path: readonly string[],
  useNode: ESTree.Node,
  environment: LexicalTypeEnvironment,
): readonly ESTree.TSInterfaceDeclaration[] {
  const [name] = path;
  if (name === undefined) return [];
  return path.length === 1
    ? environment.lookupInterfaces(name, useNode)
    : environment.lookupQualifiedInterfaces(path, useNode);
}

function aliasDeclaration(
  path: readonly string[],
  useNode: ESTree.Node,
  environment: LexicalTypeEnvironment,
): ESTree.TSTypeAliasDeclaration | null {
  const [name] = path;
  if (name === undefined) return null;
  return path.length === 1
    ? environment.lookupAlias(name, useNode)
    : environment.lookupQualifiedAlias(path, useNode);
}

function classDeclarations(
  path: readonly string[],
  useNode: ESTree.Node,
  environment: LexicalTypeEnvironment,
): readonly ESTree.Class[] {
  const [name] = path;
  if (name === undefined) return [];
  return path.length === 1
    ? environment.lookupClasses(name, useNode)
    : environment.lookupQualifiedClasses(path, useNode);
}

function bindTypeParameters(
  typeParameters: ESTree.TSTypeParameterDeclaration | null | undefined,
  arguments_: readonly ESTree.TSType[],
  callerSubstitutions: TypeSubstitutions,
): TypeSubstitutions | null {
  const parameters = typeParameters?.params ?? [];
  if (arguments_.length > parameters.length) return null;

  const substitutions = new Map<
    string,
    { readonly type: ESTree.TSType; readonly substitutions: TypeSubstitutions }
  >();
  for (const [index, parameter] of parameters.entries()) {
    const argument = arguments_[index];
    if (argument !== undefined) {
      substitutions.set(parameter.name.name, {
        type: argument,
        substitutions: callerSubstitutions,
      });
      continue;
    }
    if (parameter.default === null) return null;
    substitutions.set(parameter.name.name, {
      type: parameter.default,
      substitutions: new Map(substitutions),
    });
  }
  return substitutions;
}

function isUnknownOrAnyType(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions = EMPTY_SUBSTITUTIONS,
  resolving: ReadonlySet<object> = new Set(),
): boolean {
  const unwrapped = unwrapTypeParentheses(type);
  if (unwrapped.type === "TSUnknownKeyword" || unwrapped.type === "TSAnyKeyword") {
    return true;
  }
  if (unwrapped.type === "TSUnionType") {
    return unwrapped.types.some((member) =>
      isUnknownOrAnyType(member, environment, substitutions, resolving),
    );
  }
  if (unwrapped.type !== "TSTypeReference") return false;

  const resolved = resolveTypeReference(unwrapped, environment, substitutions);
  if (
    resolved === null ||
    resolving.has(resolved.identity) ||
    (resolved.declaration !== null && resolving.has(resolved.declaration))
  ) {
    return false;
  }
  const nextResolving = new Set(resolving);
  nextResolving.add(resolved.identity);
  if (resolved.declaration !== null) nextResolving.add(resolved.declaration);
  return isUnknownOrAnyType(resolved.type, environment, resolved.substitutions, nextResolving);
}

function isBroadRecordKeyType(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
): boolean {
  const unwrapped = unwrapTypeParentheses(type);
  if (
    unwrapped.type === "TSStringKeyword" ||
    unwrapped.type === "TSNumberKeyword" ||
    unwrapped.type === "TSSymbolKeyword"
  ) {
    return true;
  }
  if (
    unwrapped.type === "TSTypeOperator" &&
    unwrapped.operator === "keyof" &&
    unwrapTypeParentheses(unwrapped.typeAnnotation).type === "TSAnyKeyword"
  ) {
    return true;
  }
  if (unwrapped.type === "TSUnionType") {
    return unwrapped.types.some((member) =>
      isBroadRecordKeyType(member, environment, substitutions, resolving),
    );
  }
  if (unwrapped.type !== "TSTypeReference") return false;
  if (environment.isBuiltInTypeReference(unwrapped, "PropertyKey")) return true;

  const resolved = resolveTypeReference(unwrapped, environment, substitutions);
  if (
    resolved === null ||
    resolving.has(resolved.identity) ||
    (resolved.declaration !== null && resolving.has(resolved.declaration))
  ) {
    return false;
  }
  const nextResolving = new Set(resolving);
  nextResolving.add(resolved.identity);
  if (resolved.declaration !== null) nextResolving.add(resolved.declaration);
  return isBroadRecordKeyType(resolved.type, environment, resolved.substitutions, nextResolving);
}

type InterfaceRecordShape = {
  readonly allValuesUnknown: boolean;
};

function interfaceRecordShape(
  declarations: readonly ESTree.TSInterfaceDeclaration[],
  arguments_: readonly ESTree.TSType[],
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
): InterfaceRecordShape | null {
  if (declarations.length === 0) return null;
  const nextResolving = new Set(resolving);
  for (const declaration of declarations) {
    if (resolving.has(declaration)) return null;
    nextResolving.add(declaration);
  }

  let hasIndex = false;
  let allValuesUnknown = true;
  for (const declaration of declarations) {
    const declarationSubstitutions = bindTypeParameters(
      declaration.typeParameters,
      arguments_,
      substitutions,
    );
    if (declarationSubstitutions === null) return null;

    for (const member of declaration.body.body) {
      if (member.type !== "TSIndexSignature") return null;
      const [parameter] = member.parameters;
      if (
        member.parameters.length !== 1 ||
        parameter === undefined ||
        !isBroadRecordKeyType(
          parameter.typeAnnotation.typeAnnotation,
          environment,
          declarationSubstitutions,
          nextResolving,
        )
      ) {
        return null;
      }
      hasIndex = true;
      allValuesUnknown &&= isUnknownOrAnyType(
        member.typeAnnotation.typeAnnotation,
        environment,
        declarationSubstitutions,
        nextResolving,
      );
    }

    for (const heritage of declaration.extends) {
      const path = expressionNameParts(heritage.expression);
      if (path === null) return null;
      const inherited = namedRecordShape(
        path,
        heritage.typeArguments?.params ?? [],
        heritage,
        environment,
        declarationSubstitutions,
        nextResolving,
      );
      if (inherited === null) return null;
      hasIndex = true;
      allValuesUnknown &&= inherited.allValuesUnknown;
    }
  }

  return hasIndex ? { allValuesUnknown } : null;
}

function isInstanceClassMember(member: ESTree.ClassElement): boolean {
  return (
    member.type !== "StaticBlock" &&
    !("static" in member && member.static) &&
    !("kind" in member && member.kind === "constructor")
  );
}

function constructorDefinesParameterProperty(member: ESTree.ClassElement): boolean {
  return (
    (member.type === "MethodDefinition" || member.type === "TSAbstractMethodDefinition") &&
    member.kind === "constructor" &&
    member.value.params.some((parameter) => parameter.type === "TSParameterProperty")
  );
}

function classRecordShape(
  declarations: readonly ESTree.Class[],
  arguments_: readonly ESTree.TSType[],
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
): InterfaceRecordShape | null {
  if (declarations.length === 0) return null;
  const nextResolving = new Set(resolving);
  for (const declaration of declarations) {
    if (resolving.has(declaration)) return null;
    nextResolving.add(declaration);
  }

  let hasIndex = false;
  let allValuesUnknown = true;
  for (const declaration of declarations) {
    const declarationSubstitutions = bindTypeParameters(
      declaration.typeParameters,
      arguments_,
      substitutions,
    );
    if (declarationSubstitutions === null) return null;

    for (const member of declaration.body.body) {
      if (constructorDefinesParameterProperty(member)) return null;
      if (!isInstanceClassMember(member)) continue;
      if (member.type !== "TSIndexSignature") return null;
      const [parameter] = member.parameters;
      if (
        member.parameters.length !== 1 ||
        parameter === undefined ||
        !isBroadRecordKeyType(
          parameter.typeAnnotation.typeAnnotation,
          environment,
          declarationSubstitutions,
          nextResolving,
        )
      ) {
        return null;
      }
      hasIndex = true;
      allValuesUnknown &&= isUnknownOrAnyType(
        member.typeAnnotation.typeAnnotation,
        environment,
        declarationSubstitutions,
        nextResolving,
      );
    }

    if (declaration.superClass !== null) {
      const path = expressionNameParts(declaration.superClass);
      if (path === null) return null;
      const inherited = namedRecordShape(
        path,
        declaration.superTypeArguments?.params ?? [],
        declaration.superClass,
        environment,
        declarationSubstitutions,
        nextResolving,
      );
      if (inherited === null) return null;
      hasIndex = true;
      allValuesUnknown &&= inherited.allValuesUnknown;
    }
  }

  return hasIndex ? { allValuesUnknown } : null;
}

function namedRecordShape(
  path: readonly string[],
  arguments_: readonly ESTree.TSType[],
  useNode: ESTree.Node,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
): InterfaceRecordShape | null {
  const alias = aliasDeclaration(path, useNode, environment);
  if (alias !== null) {
    if (resolving.has(alias)) return null;
    const aliasSubstitutions = bindTypeParameters(alias.typeParameters, arguments_, substitutions);
    if (aliasSubstitutions === null) return null;
    const nextResolving = new Set(resolving);
    nextResolving.add(alias);
    if (
      !isBroadRecordType(
        alias.typeAnnotation,
        environment,
        false,
        aliasSubstitutions,
        nextResolving,
      )
    ) {
      return null;
    }
    return {
      allValuesUnknown: isBroadRecordType(
        alias.typeAnnotation,
        environment,
        true,
        aliasSubstitutions,
        nextResolving,
      ),
    };
  }

  const interfaces = interfaceDeclarations(path, useNode, environment);
  const classes = classDeclarations(path, useNode, environment);
  if (interfaces.length === 0 && classes.length === 0) return null;

  let allValuesUnknown = true;
  if (interfaces.length > 0) {
    const shape = interfaceRecordShape(
      interfaces,
      arguments_,
      environment,
      substitutions,
      resolving,
    );
    if (shape === null) return null;
    allValuesUnknown &&= shape.allValuesUnknown;
  }
  if (classes.length > 0) {
    const shape = classRecordShape(classes, arguments_, environment, substitutions, resolving);
    if (shape === null) return null;
    allValuesUnknown &&= shape.allValuesUnknown;
  }
  return { allValuesUnknown };
}

function isBroadRecordType(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  requireUnknownValue: boolean,
  substitutions: TypeSubstitutions = EMPTY_SUBSTITUTIONS,
  resolving: ReadonlySet<object> = new Set(),
): boolean {
  const unwrapped = unwrapTypeParentheses(type);

  if (unwrapped.type === "TSTypeReference") {
    if (environment.isBuiltInTypeReference(unwrapped, "Readonly")) {
      const [inner] = unwrapped.typeArguments?.params ?? [];
      return (
        inner !== undefined &&
        isBroadRecordType(inner, environment, requireUnknownValue, substitutions, resolving)
      );
    }

    if (environment.isBuiltInTypeReference(unwrapped, "Record")) {
      const parameters = unwrapped.typeArguments?.params ?? [];
      return (
        parameters.length === 2 &&
        parameters[0] !== undefined &&
        parameters[1] !== undefined &&
        isBroadRecordKeyType(parameters[0], environment, substitutions, resolving) &&
        (!requireUnknownValue ||
          isUnknownOrAnyType(parameters[1], environment, substitutions, resolving))
      );
    }

    const resolved = resolveTypeReference(unwrapped, environment, substitutions);
    if (resolved !== null) {
      if (
        resolving.has(resolved.identity) ||
        (resolved.declaration !== null && resolving.has(resolved.declaration))
      ) {
        return false;
      }
      const nextResolving = new Set(resolving);
      nextResolving.add(resolved.identity);
      if (resolved.declaration !== null) nextResolving.add(resolved.declaration);
      return isBroadRecordType(
        resolved.type,
        environment,
        requireUnknownValue,
        resolved.substitutions,
        nextResolving,
      );
    }

    const name = typeReferenceName(unwrapped);
    if (name !== null && environment.hasTypeParameter(name, unwrapped)) return false;
    const path = qualifiedNameParts(unwrapped.typeName);
    if (path === null) return false;
    const shape = interfaceRecordShape(
      interfaceDeclarations(path, unwrapped, environment),
      unwrapped.typeArguments?.params ?? [],
      environment,
      substitutions,
      resolving,
    );
    return shape !== null && (!requireUnknownValue || shape.allValuesUnknown);
  }

  if (unwrapped.type !== "TSTypeLiteral" || unwrapped.members.length !== 1) return false;
  const [member] = unwrapped.members;
  const [parameter] = member?.type === "TSIndexSignature" ? member.parameters : [];
  return (
    member?.type === "TSIndexSignature" &&
    member.parameters.length === 1 &&
    parameter !== undefined &&
    isBroadRecordKeyType(
      parameter.typeAnnotation.typeAnnotation,
      environment,
      substitutions,
      resolving,
    ) &&
    (!requireUnknownValue ||
      isUnknownOrAnyType(
        member.typeAnnotation.typeAnnotation,
        environment,
        substitutions,
        resolving,
      ))
  );
}

function broadTypeKind(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions = EMPTY_SUBSTITUTIONS,
  resolving: ReadonlySet<object> = new Set(),
): BroadTypeKind | null {
  const unwrapped = unwrapTypeParentheses(type);
  if (unwrapped.type === "TSUnknownKeyword" || unwrapped.type === "TSAnyKeyword") return "top";
  if (unwrapped.type === "TSObjectKeyword") return "object";
  if (isBroadRecordType(unwrapped, environment, true, substitutions, resolving)) return "record";
  if (isBroadRecordType(unwrapped, environment, false, substitutions, resolving)) {
    return "open-record";
  }
  if (unwrapped.type !== "TSTypeReference") return null;

  const resolved = resolveTypeReference(unwrapped, environment, substitutions);
  if (
    resolved === null ||
    resolving.has(resolved.identity) ||
    (resolved.declaration !== null && resolving.has(resolved.declaration))
  ) {
    return null;
  }
  const nextResolving = new Set(resolving);
  nextResolving.add(resolved.identity);
  if (resolved.declaration !== null) nextResolving.add(resolved.declaration);
  return broadTypeKind(resolved.type, environment, resolved.substitutions, nextResolving);
}

function assertedExpression(
  node: ESTree.TSAsExpression | ESTree.TSTypeAssertion,
): ESTree.Expression {
  return unwrapExpressionParentheses(node.expression);
}

function assertionFromExpression(
  expression: ESTree.Expression,
): ESTree.TSAsExpression | ESTree.TSTypeAssertion | null {
  const unwrapped = unwrapExpressionParentheses(expression);
  return unwrapped.type === "TSAsExpression" || unwrapped.type === "TSTypeAssertion"
    ? unwrapped
    : null;
}

function normalizedTypeText(sourceText: string, type: ESTree.TSType): string {
  return sourceText.slice(type.start, type.end).replaceAll(/\s+/gu, "");
}

function typesHaveSameSyntax(
  sourceText: string,
  left: ESTree.TSType | null,
  right: ESTree.TSType,
): boolean {
  return (
    left !== null &&
    normalizedTypeText(sourceText, unwrapTypeParentheses(left)) ===
      normalizedTypeText(sourceText, unwrapTypeParentheses(right))
  );
}

type InterfaceTargetCriterion = "any-member" | "named-member" | "named-or-known-index";

function isDefinitelyObjectType(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions = EMPTY_SUBSTITUTIONS,
  resolving: ReadonlySet<object> = new Set(),
): boolean {
  const unwrapped = unwrapTypeParentheses(type);
  switch (unwrapped.type) {
    case "TSArrayType":
    case "TSConstructorType":
    case "TSFunctionType":
    case "TSMappedType":
    case "TSObjectKeyword":
    case "TSTupleType":
      return true;
    case "TSTypeLiteral":
      return unwrapped.members.length > 0;
    case "TSIntersectionType":
      return unwrapped.types.every((member) =>
        isDefinitelyObjectType(member, environment, substitutions, resolving),
      );
    case "TSTypeOperator":
      return (
        unwrapped.operator === "readonly" &&
        isDefinitelyObjectType(unwrapped.typeAnnotation, environment, substitutions, resolving)
      );
    case "TSTypeReference": {
      if (environment.isBuiltInTypeReference(unwrapped, "Readonly")) {
        const [inner] = unwrapped.typeArguments?.params ?? [];
        return (
          inner !== undefined &&
          isDefinitelyObjectType(inner, environment, substitutions, resolving)
        );
      }

      const resolved = resolveTypeReference(unwrapped, environment, substitutions);
      if (resolved !== null) {
        if (
          resolving.has(resolved.identity) ||
          (resolved.declaration !== null && resolving.has(resolved.declaration))
        ) {
          return false;
        }
        const nextResolving = new Set(resolving);
        nextResolving.add(resolved.identity);
        if (resolved.declaration !== null) nextResolving.add(resolved.declaration);
        return isDefinitelyObjectType(
          resolved.type,
          environment,
          resolved.substitutions,
          nextResolving,
        );
      }

      const name = typeReferenceName(unwrapped);
      if (name !== null && environment.hasTypeParameter(name, unwrapped)) return false;
      const path = qualifiedNameParts(unwrapped.typeName);
      return (
        path !== null &&
        namedTargetIsNarrower(
          path,
          unwrapped.typeArguments?.params ?? [],
          unwrapped,
          environment,
          "any-member",
          substitutions,
          resolving,
        )
      );
    }
    default:
      return false;
  }
}

function interfaceTargetIsNarrower(
  declarations: readonly ESTree.TSInterfaceDeclaration[],
  arguments_: readonly ESTree.TSType[],
  environment: LexicalTypeEnvironment,
  criterion: InterfaceTargetCriterion,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
): boolean {
  for (const declaration of declarations) {
    if (resolving.has(declaration)) continue;
    const nextResolving = new Set(resolving);
    nextResolving.add(declaration);
    const declarationSubstitutions = bindTypeParameters(
      declaration.typeParameters,
      arguments_,
      substitutions,
    );

    for (const member of declaration.body.body) {
      if (member.type !== "TSIndexSignature" || criterion === "any-member") return true;
      if (
        criterion === "named-or-known-index" &&
        declarationSubstitutions !== null &&
        !isUnknownOrAnyType(
          member.typeAnnotation.typeAnnotation,
          environment,
          declarationSubstitutions,
          nextResolving,
        )
      ) {
        return true;
      }
    }

    if (declarationSubstitutions === null) continue;
    for (const heritage of declaration.extends) {
      const path = expressionNameParts(heritage.expression);
      if (
        path !== null &&
        namedTargetIsNarrower(
          path,
          heritage.typeArguments?.params ?? [],
          heritage,
          environment,
          criterion,
          declarationSubstitutions,
          nextResolving,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function classTargetIsNarrower(
  declarations: readonly ESTree.Class[],
  arguments_: readonly ESTree.TSType[],
  environment: LexicalTypeEnvironment,
  criterion: InterfaceTargetCriterion,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
): boolean {
  for (const declaration of declarations) {
    if (resolving.has(declaration)) continue;
    const nextResolving = new Set(resolving);
    nextResolving.add(declaration);
    const declarationSubstitutions = bindTypeParameters(
      declaration.typeParameters,
      arguments_,
      substitutions,
    );

    for (const member of declaration.body.body) {
      if (constructorDefinesParameterProperty(member)) return true;
      if (!isInstanceClassMember(member)) continue;
      if (member.type !== "TSIndexSignature" || criterion === "any-member") return true;
      if (
        criterion === "named-or-known-index" &&
        declarationSubstitutions !== null &&
        !isUnknownOrAnyType(
          member.typeAnnotation.typeAnnotation,
          environment,
          declarationSubstitutions,
          nextResolving,
        )
      ) {
        return true;
      }
    }

    if (declarationSubstitutions === null || declaration.superClass === null) continue;
    const path = expressionNameParts(declaration.superClass);
    if (
      path !== null &&
      namedTargetIsNarrower(
        path,
        declaration.superTypeArguments?.params ?? [],
        declaration.superClass,
        environment,
        criterion,
        declarationSubstitutions,
        nextResolving,
      )
    ) {
      return true;
    }
  }
  return false;
}

function namedTargetIsNarrower(
  path: readonly string[],
  arguments_: readonly ESTree.TSType[],
  useNode: ESTree.Node,
  environment: LexicalTypeEnvironment,
  criterion: InterfaceTargetCriterion,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
): boolean {
  const alias = aliasDeclaration(path, useNode, environment);
  if (alias !== null) {
    if (resolving.has(alias)) return false;
    const aliasSubstitutions = bindTypeParameters(alias.typeParameters, arguments_, substitutions);
    if (aliasSubstitutions === null) return false;
    const nextResolving = new Set(resolving);
    nextResolving.add(alias);
    return criterion === "any-member"
      ? isDefinitelyObjectType(alias.typeAnnotation, environment, aliasSubstitutions, nextResolving)
      : isDefinitelyNarrowerRecordType(
          alias.typeAnnotation,
          environment,
          criterion === "named-member",
          aliasSubstitutions,
          nextResolving,
        );
  }

  return (
    interfaceTargetIsNarrower(
      interfaceDeclarations(path, useNode, environment),
      arguments_,
      environment,
      criterion,
      substitutions,
      resolving,
    ) ||
    classTargetIsNarrower(
      classDeclarations(path, useNode, environment),
      arguments_,
      environment,
      criterion,
      substitutions,
      resolving,
    )
  );
}

function isDefinitelyNarrowerRecordType(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  requireNamedMember: boolean,
  substitutions: TypeSubstitutions = EMPTY_SUBSTITUTIONS,
  resolving: ReadonlySet<object> = new Set(),
): boolean {
  const unwrapped = unwrapTypeParentheses(type);
  if (unwrapped.type === "TSTypeLiteral") {
    return unwrapped.members.some(
      (member) =>
        member.type !== "TSIndexSignature" ||
        (!requireNamedMember &&
          !isUnknownOrAnyType(
            member.typeAnnotation.typeAnnotation,
            environment,
            substitutions,
            resolving,
          )),
    );
  }

  if (unwrapped.type !== "TSTypeReference") return false;
  if (environment.isBuiltInTypeReference(unwrapped, "Readonly")) {
    const [inner] = unwrapped.typeArguments?.params ?? [];
    return (
      inner !== undefined &&
      isDefinitelyNarrowerRecordType(
        inner,
        environment,
        requireNamedMember,
        substitutions,
        resolving,
      )
    );
  }
  if (environment.isBuiltInTypeReference(unwrapped, "Record")) {
    if (requireNamedMember) return false;
    const parameters = unwrapped.typeArguments?.params ?? [];
    return (
      parameters.length === 2 &&
      parameters[1] !== undefined &&
      !isUnknownOrAnyType(parameters[1], environment, substitutions, resolving)
    );
  }

  const resolved = resolveTypeReference(unwrapped, environment, substitutions);
  if (resolved !== null) {
    if (
      resolving.has(resolved.identity) ||
      (resolved.declaration !== null && resolving.has(resolved.declaration))
    ) {
      return false;
    }
    const nextResolving = new Set(resolving);
    nextResolving.add(resolved.identity);
    if (resolved.declaration !== null) nextResolving.add(resolved.declaration);
    return isDefinitelyNarrowerRecordType(
      resolved.type,
      environment,
      requireNamedMember,
      resolved.substitutions,
      nextResolving,
    );
  }

  const name = typeReferenceName(unwrapped);
  if (name !== null && environment.hasTypeParameter(name, unwrapped)) return false;
  const path = qualifiedNameParts(unwrapped.typeName);
  if (path === null) return false;
  return namedTargetIsNarrower(
    path,
    unwrapped.typeArguments?.params ?? [],
    unwrapped,
    environment,
    requireNamedMember ? "named-member" : "named-or-known-index",
    substitutions,
    resolving,
  );
}

function functionBoundary(node: ESTree.Node): ESTree.Node | null {
  let current = node.parent;
  while (current !== null && current.type !== "Program") {
    if (functionBoundaryTypes.has(current.type)) return current;
    current = current.parent;
  }
  return null;
}

type ResolvedVariables = WeakMap<ESTree.Node, Variable>;

function resolvedVariableForIdentifier(
  resolvedVariables: ResolvedVariables,
  identifier: ESTree.IdentifierReference,
): Variable | null {
  return resolvedVariables.get(identifier) ?? null;
}

function variableDeclarator(variable: Variable): ESTree.VariableDeclarator | null {
  for (const definition of variable.defs) {
    if (definition.type === "Variable" && definition.node.type === "VariableDeclarator") {
      return definition.node;
    }
  }
  return null;
}

function knownValueEvidence(
  expression: ESTree.Expression,
  resolvedVariables: ResolvedVariables,
  environment: LexicalTypeEnvironment,
  boundary: ESTree.Node | null,
  visitedVariables: ReadonlySet<Variable>,
): KnownValueEvidence | null {
  const unwrapped = unwrapExpressionParentheses(expression);

  if (unwrapped.type === "TSAsExpression" || unwrapped.type === "TSTypeAssertion") {
    if (broadTypeKind(unwrapped.typeAnnotation, environment) !== null) return null;
    return { type: unwrapped.typeAnnotation };
  }

  if (unwrapped.type === "Literal" || unwrapped.type === "TemplateLiteral") {
    return { type: null };
  }

  if (unwrapped.type === "ConditionalExpression") {
    const consequent = knownValueEvidence(
      unwrapped.consequent,
      resolvedVariables,
      environment,
      boundary,
      visitedVariables,
    );
    if (consequent === null) return null;
    const alternate = knownValueEvidence(
      unwrapped.alternate,
      resolvedVariables,
      environment,
      boundary,
      visitedVariables,
    );
    return alternate === null ? null : { type: null };
  }

  if (unwrapped.type === "SequenceExpression") {
    const finalExpression = unwrapped.expressions.at(-1);
    return finalExpression === undefined
      ? null
      : knownValueEvidence(
          finalExpression,
          resolvedVariables,
          environment,
          boundary,
          visitedVariables,
        );
  }

  if (
    unwrapped.type === "ArrayExpression" ||
    unwrapped.type === "ArrowFunctionExpression" ||
    unwrapped.type === "ClassExpression" ||
    unwrapped.type === "FunctionExpression" ||
    unwrapped.type === "JSXElement" ||
    unwrapped.type === "JSXFragment" ||
    unwrapped.type === "NewExpression" ||
    unwrapped.type === "ObjectExpression"
  ) {
    return { type: null };
  }

  if (unwrapped.type !== "Identifier") return null;
  const variable = resolvedVariableForIdentifier(resolvedVariables, unwrapped);
  if (variable === null || visitedVariables.has(variable)) return null;

  const annotatedIdentifier = variable.identifiers.find(
    (identifier) => identifier.typeAnnotation !== null && identifier.typeAnnotation !== undefined,
  );
  const annotation = annotatedIdentifier?.typeAnnotation?.typeAnnotation;
  if (annotation !== undefined && annotatedIdentifier !== undefined) {
    if (
      functionBoundary(annotatedIdentifier) !== boundary ||
      broadTypeKind(annotation, environment) !== null
    ) {
      return null;
    }
    return { type: annotation };
  }

  const declarator = variableDeclarator(variable);
  if (
    declarator === null ||
    declarator.parent.type !== "VariableDeclaration" ||
    declarator.parent.kind !== "const" ||
    declarator.init === null ||
    variable.references.some((reference) => reference.isWrite() && !reference.init) ||
    functionBoundary(declarator) !== boundary
  ) {
    return null;
  }

  return knownValueEvidence(
    declarator.init,
    resolvedVariables,
    environment,
    boundary,
    new Set([...visitedVariables, variable]),
  );
}

function widenedBinding(
  variable: Variable,
  resolvedVariables: ResolvedVariables,
  environment: LexicalTypeEnvironment,
): {
  readonly broadKind: BroadTypeKind;
  readonly evidence: KnownValueEvidence;
  readonly declaredAt: number;
  readonly boundary: ESTree.Node | null;
} | null {
  const declarator = variableDeclarator(variable);
  if (
    declarator === null ||
    declarator.parent.type !== "VariableDeclaration" ||
    declarator.parent.kind !== "const" ||
    declarator.id.type !== "Identifier" ||
    declarator.init === null ||
    variable.references.some((reference) => reference.isWrite() && !reference.init)
  ) {
    return null;
  }

  const boundary = functionBoundary(declarator);
  const declaredType = declarator.id.typeAnnotation?.typeAnnotation;
  const initializerAssertion = assertionFromExpression(declarator.init);
  const initializerBroadKind =
    initializerAssertion === null
      ? null
      : broadTypeKind(initializerAssertion.typeAnnotation, environment);
  const declaredBroadKind =
    declaredType === undefined ? null : broadTypeKind(declaredType, environment);
  const broadKind = declaredBroadKind ?? initializerBroadKind;
  if (broadKind === null) return null;

  const originalExpression =
    initializerAssertion !== null && initializerBroadKind !== null
      ? assertedExpression(initializerAssertion)
      : declarator.init;
  const evidence = knownValueEvidence(
    originalExpression,
    resolvedVariables,
    environment,
    boundary,
    new Set([variable]),
  );
  return evidence === null ? null : { broadKind, evidence, declaredAt: declarator.end, boundary };
}

function assertionIsNarrower(
  sourceText: string,
  broadKind: BroadTypeKind,
  evidence: KnownValueEvidence,
  assertedType: ESTree.TSType,
  environment: LexicalTypeEnvironment,
): boolean {
  const assertedKind = broadTypeKind(assertedType, environment);
  if (
    assertedKind === "top" ||
    assertedKind === "object" ||
    assertedKind === "record" ||
    (broadKind === "open-record" && assertedKind === "open-record")
  ) {
    return false;
  }
  if (broadKind === "top") return true;
  if (typesHaveSameSyntax(sourceText, evidence.type, assertedType)) return true;
  if (broadKind === "object") return isDefinitelyObjectType(assertedType, environment);
  return isDefinitelyNarrowerRecordType(assertedType, environment, broadKind === "open-record");
}

/** Detect immutable local bindings that erase a known type and are later asserted back to a narrower type. */
export const noWidenThenAssertRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow local const flows that explicitly widen a known value before asserting the widened binding to a narrower type.",
    },
    messages: {
      widenThenAssert:
        'Binding "{{name}}" discards type evidence and later recreates it with an assertion. Keep the precise type from initialization through use; parse boundary input once.',
    },
  },
  createOnce(context) {
    let resolvedVariables: ResolvedVariables = new WeakMap();
    let environment: LexicalTypeEnvironment | null = null;

    const checkAssertion = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion) => {
      const expression = assertedExpression(node);
      if (expression.type !== "Identifier") return;

      const variable = resolvedVariableForIdentifier(resolvedVariables, expression);
      if (variable === null || environment === null) return;
      const widened = widenedBinding(variable, resolvedVariables, environment);
      if (
        widened === null ||
        node.start <= widened.declaredAt ||
        functionBoundary(node) !== widened.boundary ||
        !assertionIsNarrower(
          context.sourceCode.text,
          widened.broadKind,
          widened.evidence,
          node.typeAnnotation,
          environment,
        )
      ) {
        return;
      }

      context.report({
        node,
        messageId: "widenThenAssert",
        data: { name: expression.name },
      });
    };

    return {
      Program(node) {
        resolvedVariables = new WeakMap();
        for (const scope of context.sourceCode.scopeManager.scopes) {
          for (const reference of scope.references) {
            if (reference.resolved !== null) {
              resolvedVariables.set(reference.identifier, reference.resolved);
            }
          }
        }
        environment = createLexicalTypeEnvironment(node, context.sourceCode.visitorKeys);
      },
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion,
    };
  },
});
