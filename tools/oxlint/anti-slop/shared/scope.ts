import type { ESTree, Reference, Scope, SourceCode, Variable } from "@oxlint/plugins";

export type TypeSubstitutions = ReadonlyMap<ESTree.TSTypeParameter, ESTree.TSType>;

export type ResolvedTypeAlias = {
  readonly alias: ESTree.TSTypeAliasDeclaration;
  readonly substitutions: TypeSubstitutions;
};

export type ResolvedTypeSubstitution = {
  readonly parameter: ESTree.TSTypeParameter;
  readonly type: ESTree.TSType;
};

function sameIdentifier(left: Reference["identifier"], right: ESTree.IdentifierReference): boolean {
  return left === right || (left.start === right.start && left.end === right.end);
}

function referenceInScope(scope: Scope, identifier: ESTree.IdentifierReference): Reference | null {
  return (
    scope.references.find((reference) => sameIdentifier(reference.identifier, identifier)) ??
    scope.through.find((reference) => sameIdentifier(reference.identifier, identifier)) ??
    null
  );
}

function resolveReferenceVariable(
  sourceCode: SourceCode,
  identifier: ESTree.IdentifierReference,
): Variable | null {
  let scope: Scope | null = sourceCode.getScope(identifier);
  while (scope !== null) {
    const reference = referenceInScope(scope, identifier);
    if (reference !== null) return reference.resolved;
    scope = scope.upper;
  }
  return null;
}

function resolveTypeNameVariables(
  sourceCode: SourceCode,
  name: ESTree.TSTypeReference["typeName"],
  resolving: ReadonlySet<Variable> = new Set(),
): readonly Variable[] {
  if (name.type === "Identifier") {
    const variable = resolveTypeVariable(sourceCode, name);
    if (variable === null || resolving.has(variable)) return [];
    const variables = new Set<Variable>([variable]);
    const nextResolving = new Set(resolving);
    nextResolving.add(variable);
    for (const definition of variable.defs) {
      if (
        definition.node.type !== "TSImportEqualsDeclaration" ||
        definition.node.moduleReference.type === "TSExternalModuleReference"
      ) {
        continue;
      }
      for (const target of resolveTypeNameVariables(
        sourceCode,
        definition.node.moduleReference,
        nextResolving,
      )) {
        variables.add(target);
      }
    }
    return [...variables];
  }
  if (name.type !== "TSQualifiedName") return [];

  const variables = new Set<Variable>();
  for (const namespace of resolveTypeNameVariables(sourceCode, name.left, resolving)) {
    for (const definition of namespace.defs) {
      if (definition.node.type !== "TSModuleDeclaration") continue;
      const member = sourceCode.scopeManager.acquire(definition.node)?.set.get(name.right.name);
      if (member !== undefined) variables.add(member);
    }
  }
  return [...variables];
}

/** Resolve an expression identifier in TypeScript's value namespace. */
export function resolveValueVariable(
  sourceCode: SourceCode,
  identifier: ESTree.IdentifierReference,
): Variable | null {
  return resolveReferenceVariable(sourceCode, identifier);
}

/** Resolve a type identifier in TypeScript's type namespace. */
export function resolveTypeVariable(
  sourceCode: SourceCode,
  identifier: ESTree.IdentifierReference,
): Variable | null {
  return resolveReferenceVariable(sourceCode, identifier);
}

/** Return the type alias selected by a lexical type reference. */
export function resolveTypeAlias(
  sourceCode: SourceCode,
  reference: ESTree.TSTypeReference,
): ESTree.TSTypeAliasDeclaration | null {
  const aliases = [
    ...new Set(
      resolveTypeNameVariables(sourceCode, reference.typeName).flatMap((variable) =>
        variable.defs.flatMap((definition) =>
          definition.node.type === "TSTypeAliasDeclaration" ? [definition.node] : [],
        ),
      ),
    ),
  ];
  return aliases.length === 1 ? (aliases[0] ?? null) : null;
}

function resolveTypeParameter(
  sourceCode: SourceCode,
  reference: ESTree.TSTypeReference,
): ESTree.TSTypeParameter | null {
  if (reference.typeName.type !== "Identifier") return null;
  const variable = resolveTypeVariable(sourceCode, reference.typeName);
  if (variable === null) return null;
  const parameters = variable.defs.flatMap((definition) =>
    definition.node.type === "TSTypeParameter" ? [definition.node] : [],
  );
  return parameters.length === 1 ? (parameters[0] ?? null) : null;
}

/** Return a type parameter's applied argument in the current alias expansion. */
export function resolveTypeSubstitution(
  sourceCode: SourceCode,
  reference: ESTree.TSTypeReference,
  substitutions: TypeSubstitutions,
): ResolvedTypeSubstitution | null {
  const parameter = resolveTypeParameter(sourceCode, reference);
  if (parameter === null) return null;
  const type = substitutions.get(parameter);
  return type === undefined ? null : { parameter, type };
}

function resolveSubstitutionArgument(
  sourceCode: SourceCode,
  type: ESTree.TSType,
  substitutions: TypeSubstitutions,
  resolving = new Set<ESTree.TSTypeParameter>(),
): ESTree.TSType {
  if (type.type === "TSParenthesizedType") {
    return resolveSubstitutionArgument(sourceCode, type.typeAnnotation, substitutions, resolving);
  }
  if (type.type !== "TSTypeReference") return type;
  const substitution = resolveTypeSubstitution(sourceCode, type, substitutions);
  if (substitution === null || resolving.has(substitution.parameter)) return type;
  const nextResolving = new Set(resolving);
  nextResolving.add(substitution.parameter);
  return resolveSubstitutionArgument(sourceCode, substitution.type, substitutions, nextResolving);
}

/** Resolve a lexical alias and bind its explicit or defaulted type arguments. */
export function resolveTypeAliasApplication(
  sourceCode: SourceCode,
  reference: ESTree.TSTypeReference,
  base: TypeSubstitutions,
): ResolvedTypeAlias | null {
  const alias = resolveTypeAlias(sourceCode, reference);
  if (alias === null) return null;
  const parameters = alias.typeParameters?.params ?? [];
  const arguments_ = reference.typeArguments?.params ?? [];
  const substitutions = new Map(base);
  for (const [index, parameter] of parameters.entries()) {
    const argument = arguments_[index] ?? parameter.default;
    if (argument === null || argument === undefined) return null;
    substitutions.set(parameter, resolveSubstitutionArgument(sourceCode, argument, substitutions));
  }
  return { alias, substitutions };
}

/** Return declarations when a type reference resolves exclusively to merged interfaces. */
export function resolveInterfaces(
  sourceCode: SourceCode,
  reference: ESTree.TSTypeReference,
): readonly ESTree.TSInterfaceDeclaration[] {
  const definitions = [
    ...new Set(
      resolveTypeNameVariables(sourceCode, reference.typeName).flatMap((variable) => variable.defs),
    ),
  ].filter((definition) => definition.node.type !== "TSImportEqualsDeclaration");
  if (definitions.some((definition) => definition.node.type !== "TSInterfaceDeclaration")) {
    return [];
  }
  return definitions.flatMap((definition) =>
    definition.node.type === "TSInterfaceDeclaration" ? [definition.node] : [],
  );
}

/** Check that a type reference resolves to an unshadowed global declaration. */
export function isGlobalTypeReference(
  sourceCode: SourceCode,
  reference: ESTree.TSTypeReference,
  name: string,
): boolean {
  if (reference.typeName.type === "Identifier") {
    if (reference.typeName.name !== name) return false;
    const variable = resolveTypeVariable(sourceCode, reference.typeName);
    return variable === null || variable.defs.length === 0;
  }
  if (
    reference.typeName.type !== "TSQualifiedName" ||
    reference.typeName.left.type !== "Identifier" ||
    reference.typeName.left.name !== "globalThis" ||
    reference.typeName.right.name !== name
  ) {
    return false;
  }
  const namespace = resolveTypeVariable(sourceCode, reference.typeName.left);
  return namespace === null || namespace.defs.length === 0;
}
