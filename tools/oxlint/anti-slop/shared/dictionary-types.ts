import type { ESTree } from "@oxlint/plugins";

import {
  resolveTypeReference,
  type LexicalTypeEnvironment,
  type TypeSubstitutions,
} from "./type-environment.ts";

const TRANSPARENT_WRAPPERS = new Set(["Readonly", "Partial", "Required", "NonNullable"]);
const EMPTY_SUBSTITUTIONS: TypeSubstitutions = new Map();
const STRING_KEY_DOMAIN = 1;
const NUMBER_KEY_DOMAIN = 2;
const SYMBOL_KEY_DOMAIN = 4;
const BIGINT_TEMPLATE_DOMAIN = 8;
const PROPERTY_KEY_DOMAIN = STRING_KEY_DOMAIN | NUMBER_KEY_DOMAIN | SYMBOL_KEY_DOMAIN;
const STRING_DOMAIN_WRAPPERS = new Set(["Capitalize", "Lowercase", "Uncapitalize", "Uppercase"]);

type ResolvedType = {
  readonly type: ESTree.TSType;
  readonly substitutions: TypeSubstitutions;
};

export type UnsafeDictionary = {
  readonly kind: "unsafe-dictionary";
  readonly unsafeValue: "any" | "empty-object" | "object" | "union" | "unknown";
};

export type WideningTargetKind =
  | "anonymous object"
  | "finite dictionary"
  | "generic container"
  | "object"
  | "open dictionary"
  | "unknown";

export type WideningTarget = {
  readonly kind: WideningTargetKind;
};

function typeReferenceName(type: ESTree.TSTypeReference): string | null {
  return type.typeName.type === "Identifier" ? type.typeName.name : null;
}

function typeReferencePath(type: ESTree.TSTypeReference): readonly string[] | null {
  if (type.typeName.type === "Identifier") return [type.typeName.name];
  if (type.typeName.type !== "TSQualifiedName") return null;

  const path = [type.typeName.right.name];
  let current = type.typeName.left;
  while (current.type === "TSQualifiedName") {
    path.push(current.right.name);
    current = current.left;
  }
  if (current.type !== "Identifier") return null;
  path.push(current.name);
  return path.reverse();
}

function expressionPath(expression: ESTree.Expression): readonly string[] | null {
  if (expression.type === "Identifier") return [expression.name];
  if (
    expression.type !== "MemberExpression" ||
    expression.computed ||
    expression.property.type !== "Identifier"
  ) {
    return null;
  }
  const owner = expressionPath(expression.object);
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

function isBuiltInReference(
  type: ESTree.TSTypeReference,
  name: string,
  environment: LexicalTypeEnvironment,
): boolean {
  return environment.isBuiltInTypeReference(type, name);
}

function isBuiltInReferenceFrom(
  type: ESTree.TSTypeReference,
  names: ReadonlySet<string>,
  environment: LexicalTypeEnvironment,
): boolean {
  return [...names].some((name) => isBuiltInReference(type, name, environment));
}

function unwrapTransparentType(type: ESTree.TSType): ESTree.TSType {
  let current = type;
  while (
    current.type === "TSParenthesizedType" ||
    (current.type === "TSTypeOperator" && current.operator === "readonly")
  ) {
    current = current.typeAnnotation;
  }
  return current;
}

function isNeverType(type: ESTree.TSType): boolean {
  return unwrapTransparentType(type).type === "TSNeverKeyword";
}

function isEffectivelyEmptyMember(member: ESTree.TSSignature): boolean {
  return (
    member.type === "TSPropertySignature" &&
    member.optional === true &&
    member.typeAnnotation !== null &&
    member.typeAnnotation !== undefined &&
    isNeverType(member.typeAnnotation.typeAnnotation)
  );
}

function isEffectivelyEmptyTypeLiteral(type: ESTree.TSTypeLiteral): boolean {
  return type.members.length === 0 || type.members.every(isEffectivelyEmptyMember);
}

function isConcreteClassMember(member: ESTree.ClassElement): boolean {
  if (member.type === "StaticBlock" || ("static" in member && member.static)) return false;
  return member.type !== "MethodDefinition" || member.kind !== "constructor";
}

function hasConcreteClassContract(declarations: readonly ESTree.Class[]): boolean {
  return declarations.some(
    (declaration) =>
      declaration.body.body.some(isConcreteClassMember) || declaration.superClass !== null,
  );
}

function isEffectivelyEmptyInterface(
  declarations: readonly ESTree.TSInterfaceDeclaration[],
  environment: LexicalTypeEnvironment,
  resolving: ReadonlySet<object>,
): boolean {
  if (declarations.length === 0) return false;
  const nextResolving = new Set(resolving);
  for (const declaration of declarations) {
    if (resolving.has(declaration)) return false;
    nextResolving.add(declaration);
  }

  return declarations.every(
    (declaration) =>
      declaration.body.body.every(isEffectivelyEmptyMember) &&
      declaration.extends.every((heritage) => {
        const path = expressionPath(heritage.expression);
        return (
          path !== null &&
          isEffectivelyEmptyInterface(
            interfaceDeclarations(path, heritage, environment),
            environment,
            nextResolving,
          )
        );
      }),
  );
}

function isEffectivelyEmptyNamedType(
  path: readonly string[],
  useNode: ESTree.Node,
  environment: LexicalTypeEnvironment,
  resolving: ReadonlySet<object>,
): boolean {
  if (hasConcreteClassContract(classDeclarations(path, useNode, environment))) return false;
  return isEffectivelyEmptyInterface(
    interfaceDeclarations(path, useNode, environment),
    environment,
    resolving,
  );
}

function isRequiredNonIndexMember(member: ESTree.TSSignature): boolean {
  if (member.type === "TSIndexSignature") return false;
  if (member.type === "TSPropertySignature" || member.type === "TSMethodSignature") {
    return !member.optional;
  }
  return true;
}

function interfaceHasRequiredNonIndexMember(
  declarations: readonly ESTree.TSInterfaceDeclaration[],
  environment: LexicalTypeEnvironment,
  resolving: ReadonlySet<object>,
): boolean {
  const nextResolving = new Set(resolving);
  for (const declaration of declarations) {
    if (resolving.has(declaration)) return true;
    nextResolving.add(declaration);
  }

  return declarations.some(
    (declaration) =>
      declaration.body.body.some(isRequiredNonIndexMember) ||
      declaration.extends.some((heritage) => {
        const path = expressionPath(heritage.expression);
        if (path === null) return true;
        const bases = interfaceDeclarations(path, heritage, environment);
        return (
          bases.length === 0 ||
          interfaceHasRequiredNonIndexMember(bases, environment, nextResolving)
        );
      }),
  );
}

function isNeverKeyDomain(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
): boolean {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSNeverKeyword") return true;
  if (unwrapped.type === "TSUnionType") {
    return (
      unwrapped.types.length > 0 &&
      unwrapped.types.every((member) =>
        isNeverKeyDomain(member, environment, substitutions, resolving),
      )
    );
  }
  if (unwrapped.type === "TSIntersectionType") {
    return unwrapped.types.some((member) =>
      isNeverKeyDomain(member, environment, substitutions, resolving),
    );
  }
  if (unwrapped.type !== "TSTypeReference") return false;

  const resolved = resolveTypeReference(unwrapped, environment, substitutions);
  if (resolved === null || resolving.has(resolved.identity)) return false;
  const nextResolving = new Set(resolving);
  nextResolving.add(resolved.identity);
  return isNeverKeyDomain(resolved.type, environment, resolved.substitutions, nextResolving);
}

function unsafeDirectValue(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
  unwrapPromiseResult = false,
): UnsafeDictionary["unsafeValue"] | null {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSUnknownKeyword") return "unknown";
  if (unwrapped.type === "TSAnyKeyword") return "any";
  if (unwrapped.type === "TSObjectKeyword") return "object";
  if (unwrapped.type === "TSTypeLiteral" && isEffectivelyEmptyTypeLiteral(unwrapped)) {
    return "empty-object";
  }
  if (
    unwrapped.type === "TSMappedType" &&
    isNeverKeyDomain(unwrapped.constraint, environment, substitutions, resolving)
  ) {
    return "empty-object";
  }
  if (unwrapped.type === "TSUnionType") {
    return unwrapped.types.some(
      (member) =>
        unsafeDirectValue(member, environment, substitutions, resolving, unwrapPromiseResult) !==
        null,
    )
      ? "union"
      : null;
  }
  if (unwrapped.type === "TSIntersectionType") {
    const unsafeMembers = unwrapped.types.map((member) =>
      unsafeDirectValue(member, environment, substitutions, resolving, unwrapPromiseResult),
    );
    if (unsafeMembers.includes("any")) return "any";
    return unsafeMembers.length > 0 && unsafeMembers.every((member) => member !== null)
      ? unsafeMembers[0]
      : null;
  }
  if (unwrapped.type !== "TSTypeReference") return null;

  const path = typeReferencePath(unwrapped);
  if (path === null) return null;
  const name = typeReferenceName(unwrapped);
  if (isBuiltInReference(unwrapped, "Awaited", environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined
      ? null
      : unsafeDirectValue(wrapped, environment, substitutions, resolving, true);
  }
  if (
    unwrapPromiseResult &&
    (isBuiltInReference(unwrapped, "Promise", environment) ||
      isBuiltInReference(unwrapped, "PromiseLike", environment))
  ) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined
      ? null
      : unsafeDirectValue(wrapped, environment, substitutions, resolving, true);
  }
  if (isBuiltInReferenceFrom(unwrapped, TRANSPARENT_WRAPPERS, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined
      ? null
      : unsafeDirectValue(wrapped, environment, substitutions, resolving, unwrapPromiseResult);
  }
  if (isBuiltInReference(unwrapped, "Record", environment)) {
    const key = unwrapped.typeArguments?.params[0];
    return key !== undefined && isNeverKeyDomain(key, environment, substitutions, resolving)
      ? "empty-object"
      : null;
  }
  if (isBuiltInReference(unwrapped, "Pick", environment)) {
    const key = unwrapped.typeArguments?.params[1];
    return key !== undefined && isNeverKeyDomain(key, environment, substitutions, resolving)
      ? "empty-object"
      : null;
  }

  const resolved = resolveTypeReference(unwrapped, environment, substitutions);
  if (resolved !== null) {
    if (resolving.has(resolved.identity)) return null;
    const nextResolving = new Set(resolving);
    nextResolving.add(resolved.identity);
    return unsafeDirectValue(
      resolved.type,
      environment,
      resolved.substitutions,
      nextResolving,
      unwrapPromiseResult,
    );
  }

  if (name !== null && environment.hasTypeParameter(name, unwrapped)) return null;
  return isEffectivelyEmptyNamedType(path, unwrapped, environment, resolving)
    ? "empty-object"
    : null;
}

function dictionaryValueTypes(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
): readonly ResolvedType[] {
  const unwrapped = unwrapTransparentType(type);

  if (unwrapped.type === "TSTypeLiteral") {
    return unwrapped.members.flatMap((member): readonly ResolvedType[] =>
      member.type === "TSIndexSignature"
        ? [{ type: member.typeAnnotation.typeAnnotation, substitutions }]
        : [],
    );
  }

  if (unwrapped.type === "TSMappedType") {
    const mappedSubstitutions = new Map(substitutions);
    mappedSubstitutions.delete(unwrapped.key.name);
    return unwrapped.typeAnnotation === null
      ? []
      : [{ type: unwrapped.typeAnnotation, substitutions: mappedSubstitutions }];
  }

  if (unwrapped.type !== "TSTypeReference") return [];
  const name = typeReferenceName(unwrapped);

  if (isBuiltInReferenceFrom(unwrapped, TRANSPARENT_WRAPPERS, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined
      ? []
      : dictionaryValueTypes(wrapped, environment, substitutions, resolving);
  }

  if (isBuiltInReference(unwrapped, "Record", environment)) {
    const value = unwrapped.typeArguments?.params[1];
    return value === undefined ? [] : [{ type: value, substitutions }];
  }

  if (
    isBuiltInReference(unwrapped, "Pick", environment) ||
    isBuiltInReference(unwrapped, "Omit", environment)
  ) {
    const source = unwrapped.typeArguments?.params[0];
    return source === undefined
      ? []
      : dictionaryValueTypes(source, environment, substitutions, resolving);
  }

  const resolved = resolveTypeReference(unwrapped, environment, substitutions);
  if (resolved === null || resolving.has(resolved.identity)) return [];
  const nextResolving = new Set(resolving);
  nextResolving.add(resolved.identity);
  return dictionaryValueTypes(resolved.type, environment, resolved.substitutions, nextResolving);
}

export function classifyUnsafeDictionaryValue(
  valueType: ESTree.TSType,
  environment: LexicalTypeEnvironment,
): UnsafeDictionary | null {
  const unsafeValue = unsafeDirectValue(valueType, environment, EMPTY_SUBSTITUTIONS, new Set());
  return unsafeValue === null ? null : { kind: "unsafe-dictionary", unsafeValue };
}

export function classifyUnsafeDictionary(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
): UnsafeDictionary | null {
  for (const valueType of dictionaryValueTypes(type, environment, EMPTY_SUBSTITUTIONS, new Set())) {
    const unsafeValue = unsafeDirectValue(
      valueType.type,
      environment,
      valueType.substitutions,
      new Set(),
    );
    if (unsafeValue !== null) return { kind: "unsafe-dictionary", unsafeValue };
  }
  return null;
}

function neutralIntersectionMember(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
): boolean {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSUnknownKeyword" || unwrapped.type === "TSAnyKeyword") {
    return true;
  }
  if (unwrapped.type === "TSTypeLiteral") return unwrapped.members.length === 0;
  if (unwrapped.type !== "TSTypeReference") return false;

  const resolved = resolveTypeReference(unwrapped, environment, substitutions);
  if (resolved !== null) {
    if (resolving.has(resolved.identity)) return false;
    const nextResolving = new Set(resolving);
    nextResolving.add(resolved.identity);
    return neutralIntersectionMember(
      resolved.type,
      environment,
      resolved.substitutions,
      nextResolving,
    );
  }

  const path = typeReferencePath(unwrapped);
  if (path === null) return false;
  const name = typeReferenceName(unwrapped);
  return (
    !(name !== null && environment.hasTypeParameter(name, unwrapped)) &&
    isEffectivelyEmptyInterface(
      interfaceDeclarations(path, unwrapped, environment),
      environment,
      resolving,
    )
  );
}

function broadMappedKeyDomain(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
): number {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSStringKeyword") return STRING_KEY_DOMAIN;
  if (unwrapped.type === "TSNumberKeyword") return NUMBER_KEY_DOMAIN;
  if (unwrapped.type === "TSSymbolKeyword") return SYMBOL_KEY_DOMAIN;
  if (unwrapped.type === "TSBigIntKeyword") return BIGINT_TEMPLATE_DOMAIN;
  if (unwrapped.type === "TSAnyKeyword") return PROPERTY_KEY_DOMAIN;
  if (unwrapped.type === "TSTypeOperator" && unwrapped.operator === "keyof") {
    return keyofMappedKeyDomain(unwrapped.typeAnnotation, environment, substitutions, resolving);
  }
  if (unwrapped.type === "TSUnionType") {
    return unwrapped.types.reduce(
      (domain, member) =>
        domain | broadMappedKeyDomain(member, environment, substitutions, resolving),
      0,
    );
  }
  if (unwrapped.type === "TSIntersectionType") {
    let domain = PROPERTY_KEY_DOMAIN | BIGINT_TEMPLATE_DOMAIN;
    let hasBroadDomain = false;
    for (const member of unwrapped.types) {
      const memberDomain = broadMappedKeyDomain(member, environment, substitutions, resolving);
      if (memberDomain !== 0) {
        domain &= memberDomain;
        hasBroadDomain = true;
        continue;
      }
      if (!neutralIntersectionMember(member, environment, substitutions, resolving)) {
        return 0;
      }
    }
    return hasBroadDomain ? domain : 0;
  }
  if (unwrapped.type === "TSTemplateLiteralType") {
    return unwrapped.types.some(
      (member) =>
        (broadMappedKeyDomain(member, environment, substitutions, resolving) &
          (STRING_KEY_DOMAIN | NUMBER_KEY_DOMAIN | BIGINT_TEMPLATE_DOMAIN)) !==
        0,
    )
      ? STRING_KEY_DOMAIN
      : 0;
  }
  if (unwrapped.type !== "TSTypeReference") return 0;
  if (isBuiltInReference(unwrapped, "PropertyKey", environment)) {
    return PROPERTY_KEY_DOMAIN;
  }
  const name = typeReferenceName(unwrapped);
  if (isBuiltInReferenceFrom(unwrapped, STRING_DOMAIN_WRAPPERS, environment)) {
    const value = unwrapped.typeArguments?.params[0];
    return value !== undefined &&
      (broadMappedKeyDomain(value, environment, substitutions, resolving) & STRING_KEY_DOMAIN) !== 0
      ? STRING_KEY_DOMAIN
      : 0;
  }

  const resolved = resolveTypeReference(unwrapped, environment, substitutions);
  if (resolved === null || resolving.has(resolved.identity)) return 0;
  const nextResolving = new Set(resolving);
  nextResolving.add(resolved.identity);
  return broadMappedKeyDomain(resolved.type, environment, resolved.substitutions, nextResolving);
}

function keyofMappedKeyDomain(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
): number {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSAnyKeyword") return PROPERTY_KEY_DOMAIN;
  if (unwrapped.type === "TSTypeLiteral") {
    return unwrapped.members.reduce((domain, member) => {
      if (member.type !== "TSIndexSignature") return domain;
      const [parameter] = member.parameters;
      return parameter === undefined
        ? domain
        : domain |
            (broadMappedKeyDomain(
              parameter.typeAnnotation.typeAnnotation,
              environment,
              substitutions,
              resolving,
            ) &
              PROPERTY_KEY_DOMAIN);
    }, 0);
  }
  if (unwrapped.type === "TSMappedType") {
    return (
      broadMappedKeyDomain(
        unwrapped.nameType ?? unwrapped.constraint,
        environment,
        substitutions,
        resolving,
      ) & PROPERTY_KEY_DOMAIN
    );
  }
  if (unwrapped.type !== "TSTypeReference") return 0;

  if (isBuiltInReference(unwrapped, "Record", environment)) {
    const key = unwrapped.typeArguments?.params[0];
    return key === undefined
      ? 0
      : broadMappedKeyDomain(key, environment, substitutions, resolving) & PROPERTY_KEY_DOMAIN;
  }

  const name = typeReferenceName(unwrapped);
  if (isBuiltInReferenceFrom(unwrapped, TRANSPARENT_WRAPPERS, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined
      ? 0
      : keyofMappedKeyDomain(wrapped, environment, substitutions, resolving);
  }

  const resolved = resolveTypeReference(unwrapped, environment, substitutions);
  if (resolved !== null) {
    if (resolving.has(resolved.identity)) return 0;
    const nextResolving = new Set(resolving);
    nextResolving.add(resolved.identity);
    return keyofMappedKeyDomain(resolved.type, environment, resolved.substitutions, nextResolving);
  }

  if (name !== null && environment.hasTypeParameter(name, unwrapped)) return 0;
  const path = typeReferencePath(unwrapped);
  if (path === null) return 0;
  return interfaceDeclarations(path, unwrapped, environment).reduce(
    (domain, declaration) =>
      domain |
      declaration.body.body.reduce((memberDomain, member) => {
        if (member.type !== "TSIndexSignature") return memberDomain;
        const [parameter] = member.parameters;
        return parameter === undefined
          ? memberDomain
          : memberDomain |
              (broadMappedKeyDomain(
                parameter.typeAnnotation.typeAnnotation,
                environment,
                substitutions,
                resolving,
              ) &
                PROPERTY_KEY_DOMAIN);
      }, 0),
    0,
  );
}

function isBroadMappedKey(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
): boolean {
  return (
    (broadMappedKeyDomain(type, environment, substitutions, resolving) & PROPERTY_KEY_DOMAIN) !== 0
  );
}

function isDefinitelyFiniteKeyofOperand(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
): boolean {
  const operand = unwrapTransparentType(type);
  if (operand.type === "TSTypeLiteral") {
    return (
      operand.members.some((member) => member.type !== "TSIndexSignature") &&
      !operand.members.some((member) => member.type === "TSIndexSignature")
    );
  }
  if (operand.type === "TSMappedType") {
    return isDefinitelyFiniteKeyDomain(
      operand.nameType ?? operand.constraint,
      environment,
      substitutions,
      resolving,
    );
  }
  if (operand.type !== "TSTypeReference") return false;
  if (isBuiltInReference(operand, "Record", environment)) {
    const key = operand.typeArguments?.params[0];
    return (
      key !== undefined && isDefinitelyFiniteKeyDomain(key, environment, substitutions, resolving)
    );
  }
  const resolved = resolveTypeReference(operand, environment, substitutions);
  if (resolved !== null && !resolving.has(resolved.identity)) {
    const nextResolving = new Set(resolving);
    nextResolving.add(resolved.identity);
    return isDefinitelyFiniteKeyofOperand(
      resolved.type,
      environment,
      resolved.substitutions,
      nextResolving,
    );
  }
  const path = typeReferencePath(operand);
  if (path === null) return false;
  const declarations = interfaceDeclarations(path, operand, environment);
  return (
    declarations.some((declaration) =>
      declaration.body.body.some((member) => member.type !== "TSIndexSignature"),
    ) &&
    declarations.every((declaration) =>
      declaration.body.body.every((member) => member.type !== "TSIndexSignature"),
    )
  );
}

function isDefinitelyFiniteKeyDomain(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
): boolean {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSLiteralType") return true;
  if (unwrapped.type === "TSUnionType") {
    let hasFiniteMember = false;
    for (const member of unwrapped.types) {
      if (isNeverKeyDomain(member, environment, substitutions, resolving)) continue;
      if (!isDefinitelyFiniteKeyDomain(member, environment, substitutions, resolving)) {
        return false;
      }
      hasFiniteMember = true;
    }
    return hasFiniteMember;
  }
  if (unwrapped.type === "TSIntersectionType") {
    return unwrapped.types.some((member) =>
      isDefinitelyFiniteKeyDomain(member, environment, substitutions, resolving),
    );
  }
  if (unwrapped.type === "TSTemplateLiteralType") {
    return unwrapped.types.every((member) =>
      isDefinitelyFiniteKeyDomain(member, environment, substitutions, resolving),
    );
  }
  if (unwrapped.type === "TSTypeOperator" && unwrapped.operator === "keyof") {
    return isDefinitelyFiniteKeyofOperand(
      unwrapped.typeAnnotation,
      environment,
      substitutions,
      resolving,
    );
  }
  if (unwrapped.type !== "TSTypeReference") return false;
  if (isBuiltInReferenceFrom(unwrapped, STRING_DOMAIN_WRAPPERS, environment)) {
    const value = unwrapped.typeArguments?.params[0];
    return (
      value !== undefined &&
      isDefinitelyFiniteKeyDomain(value, environment, substitutions, resolving)
    );
  }
  const resolved = resolveTypeReference(unwrapped, environment, substitutions);
  if (resolved === null || resolving.has(resolved.identity)) return false;
  const nextResolving = new Set(resolving);
  nextResolving.add(resolved.identity);
  return isDefinitelyFiniteKeyDomain(
    resolved.type,
    environment,
    resolved.substitutions,
    nextResolving,
  );
}

function classifyWideningTargetInternal(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
  allowAnonymousObject: boolean,
  unwrapPromiseResult: boolean,
): WideningTarget | null {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSUnknownKeyword") return { kind: "unknown" };
  if (unwrapped.type === "TSObjectKeyword") return { kind: "object" };
  if (unwrapped.type === "TSTypeLiteral") {
    const hasIndex = unwrapped.members.some((member) => member.type === "TSIndexSignature");
    if (hasIndex && !unwrapped.members.some(isRequiredNonIndexMember)) {
      return { kind: "open dictionary" };
    }
    return allowAnonymousObject && unwrapped.members.length > 0
      ? { kind: "anonymous object" }
      : null;
  }
  if (unwrapped.type === "TSMappedType") {
    if (isBroadMappedKey(unwrapped.constraint, environment, substitutions, resolving)) {
      return { kind: "open dictionary" };
    }
    return isDefinitelyFiniteKeyDomain(unwrapped.constraint, environment, substitutions, resolving)
      ? { kind: "finite dictionary" }
      : null;
  }
  if (unwrapped.type !== "TSTypeReference") return null;

  const path = typeReferencePath(unwrapped);
  if (path === null) return null;
  const name = typeReferenceName(unwrapped);
  if (isBuiltInReference(unwrapped, "Awaited", environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined
      ? null
      : classifyWideningTargetInternal(
          wrapped,
          environment,
          substitutions,
          resolving,
          allowAnonymousObject,
          true,
        );
  }
  if (
    unwrapPromiseResult &&
    (isBuiltInReference(unwrapped, "Promise", environment) ||
      isBuiltInReference(unwrapped, "PromiseLike", environment))
  ) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined
      ? null
      : classifyWideningTargetInternal(
          wrapped,
          environment,
          substitutions,
          resolving,
          allowAnonymousObject,
          true,
        );
  }
  if (isBuiltInReferenceFrom(unwrapped, TRANSPARENT_WRAPPERS, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined
      ? null
      : classifyWideningTargetInternal(
          wrapped,
          environment,
          substitutions,
          resolving,
          allowAnonymousObject,
          unwrapPromiseResult,
        );
  }
  if (isBuiltInReference(unwrapped, "Record", environment)) {
    const key = unwrapped.typeArguments?.params[0];
    if (key === undefined) return null;
    if (isBroadMappedKey(key, environment, substitutions, resolving)) {
      return { kind: "open dictionary" };
    }
    return isDefinitelyFiniteKeyDomain(key, environment, substitutions, resolving)
      ? { kind: "finite dictionary" }
      : null;
  }

  const resolved = resolveTypeReference(unwrapped, environment, substitutions);
  if (resolved === null) {
    if (name !== null && environment.hasTypeParameter(name, unwrapped)) return null;
    const declarations = interfaceDeclarations(path, unwrapped, environment);
    const hasBroadIndex = declarations.some((declaration) =>
      declaration.body.body.some((member) => {
        if (member.type !== "TSIndexSignature") return false;
        const [parameter] = member.parameters;
        return (
          parameter !== undefined &&
          isBroadMappedKey(
            parameter.typeAnnotation.typeAnnotation,
            environment,
            substitutions,
            resolving,
          )
        );
      }),
    );
    return hasBroadIndex &&
      !interfaceHasRequiredNonIndexMember(declarations, environment, resolving)
      ? { kind: "open dictionary" }
      : null;
  }
  if (resolving.has(resolved.identity)) return null;
  const nextResolving = new Set(resolving);
  nextResolving.add(resolved.identity);

  if (
    resolved.declaration !== null &&
    (resolved.declaration.typeParameters?.params.length ?? 0) > 0
  ) {
    const target = classifyWideningTargetInternal(
      resolved.type,
      environment,
      resolved.substitutions,
      nextResolving,
      false,
      unwrapPromiseResult,
    );
    if (target?.kind === "open dictionary" || target?.kind === "generic container") {
      return { kind: "generic container" };
    }
    return target?.kind === "finite dictionary" ? target : null;
  }

  return classifyWideningTargetInternal(
    resolved.type,
    environment,
    resolved.substitutions,
    nextResolving,
    false,
    unwrapPromiseResult,
  );
}

export function classifyWideningTarget(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
): WideningTarget | null {
  return classifyWideningTargetInternal(
    type,
    environment,
    EMPTY_SUBSTITUTIONS,
    new Set(),
    true,
    false,
  );
}

function classifyPromiseResultWideningTargetInternal(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  resolving: ReadonlySet<object>,
): WideningTarget | null {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type !== "TSTypeReference") return null;

  if (isBuiltInReference(unwrapped, "Promise", environment)) {
    const result = unwrapped.typeArguments?.params[0];
    return result === undefined
      ? null
      : classifyWideningTargetInternal(result, environment, substitutions, resolving, true, false);
  }

  const resolved = resolveTypeReference(unwrapped, environment, substitutions);
  if (resolved === null || resolving.has(resolved.identity)) return null;
  const nextResolving = new Set(resolving);
  nextResolving.add(resolved.identity);
  return classifyPromiseResultWideningTargetInternal(
    resolved.type,
    environment,
    resolved.substitutions,
    nextResolving,
  );
}

/** Classify the result of a built-in Promise reached through local type aliases. */
export function classifyPromiseResultWideningTarget(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
): WideningTarget | null {
  return classifyPromiseResultWideningTargetInternal(
    type,
    environment,
    EMPTY_SUBSTITUTIONS,
    new Set(),
  );
}

export function isKnownEvidenceExpression(expression: ESTree.Expression): boolean {
  let current = expression;
  while (
    current.type === "ParenthesizedExpression" ||
    current.type === "TSAsExpression" ||
    current.type === "TSTypeAssertion" ||
    current.type === "TSNonNullExpression" ||
    current.type === "TSSatisfiesExpression"
  ) {
    current = current.expression;
  }
  if (current.type === "ConditionalExpression") {
    return (
      isKnownEvidenceExpression(current.consequent) && isKnownEvidenceExpression(current.alternate)
    );
  }
  if (current.type === "SequenceExpression") {
    const finalExpression = current.expressions.at(-1);
    return finalExpression !== undefined && isKnownEvidenceExpression(finalExpression);
  }
  if (current.type === "ObjectExpression") return true;
  return (
    current.type === "ArrayExpression" ||
    current.type === "ArrowFunctionExpression" ||
    current.type === "ClassExpression" ||
    current.type === "FunctionExpression" ||
    current.type === "JSXElement" ||
    current.type === "JSXFragment" ||
    current.type === "NewExpression" ||
    current.type === "Literal" ||
    current.type === "TemplateLiteral" ||
    current.type === "UnaryExpression"
  );
}
