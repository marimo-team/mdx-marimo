import type { ESTree } from "@oxlint/plugins";

import { lexicalTypeParameterNames } from "./lexical-type-parameters.ts";

type VisitorKeys = Readonly<Record<string, readonly string[]>>;
type TypeStateInput = ESTree.TSType | ESTree.TSOptionalType | ESTree.TSRestType;

type TypeBindings = {
  readonly aliases: Map<string, ESTree.TSTypeAliasDeclaration>;
  readonly classes: Map<string, ESTree.Class[]>;
  readonly importEquals: Map<string, ImportEqualsBinding>;
  readonly interfaces: Map<string, ESTree.TSInterfaceDeclaration[]>;
  readonly namespaces: Map<string, TypeBindings>;
  readonly bindings: Set<string>;
};

type ImportEqualsBinding = {
  readonly declaration: ESTree.TSImportEqualsDeclaration;
  readonly target: readonly string[];
};

type TypeScope = TypeBindings & {
  readonly parent: TypeScope | null;
  readonly merged: TypeBindings | null;
  readonly namespacePath: string | null;
  readonly mergeRoot: object;
  readonly ambient: boolean;
};

type NamespaceScope = {
  readonly bindings: TypeBindings;
  readonly path: string;
  readonly mergeRoot: object;
  readonly ambient: boolean;
};

type ResolutionIdentityStore = {
  readonly aliasIdentities: WeakMap<ESTree.TSTypeAliasDeclaration, Map<string, TypeSubstitution>>;
  readonly nodeIds: WeakMap<object, number>;
  nextNodeId: number;
};

export type LexicalTypeEnvironment = {
  lookupAlias(name: string, useNode: ESTree.Node): ESTree.TSTypeAliasDeclaration | null;
  lookupQualifiedAlias(
    path: readonly string[],
    useNode: ESTree.Node,
  ): ESTree.TSTypeAliasDeclaration | null;
  lookupInterfaces(name: string, useNode: ESTree.Node): readonly ESTree.TSInterfaceDeclaration[];
  lookupQualifiedInterfaces(
    path: readonly string[],
    useNode: ESTree.Node,
  ): readonly ESTree.TSInterfaceDeclaration[];
  lookupClasses(name: string, useNode: ESTree.Node): readonly ESTree.Class[];
  lookupQualifiedClasses(path: readonly string[], useNode: ESTree.Node): readonly ESTree.Class[];
  hasTypeParameter(name: string, useNode: ESTree.Node): boolean;
  isBuiltInType(name: string, useNode: ESTree.Node): boolean;
  isBuiltInTypeReference(type: ESTree.TSTypeReference, name: string): boolean;
};

export type TypeSubstitution = {
  readonly type: ESTree.TSType;
  readonly substitutions: TypeSubstitutions;
};

export type TypeSubstitutions = ReadonlyMap<string, TypeSubstitution>;

export type ResolvedTypeReference = {
  readonly type: ESTree.TSType;
  readonly substitutions: TypeSubstitutions;
  readonly declaration: ESTree.TSTypeAliasDeclaration | null;
  readonly identity: ESTree.TSTypeAliasDeclaration | TypeSubstitution;
};

type UnknownResolutionOptions = {
  readonly unwrapPromises?: boolean;
};

type ObjectResolutionOptions = {
  readonly unwrapPromises?: boolean;
};

const EMPTY_SUBSTITUTIONS: TypeSubstitutions = new Map();
const OBJECT_TRANSPARENT_WRAPPERS = new Set(["NonNullable", "Partial", "Readonly", "Required"]);
const MAX_TYPE_STATE_DEPTH = 64;
const RESOLUTION_IDENTITIES = new WeakMap<LexicalTypeEnvironment, ResolutionIdentityStore>();
const LEXICAL_ENVIRONMENTS = new WeakMap<ESTree.Program, LexicalTypeEnvironment>();

function isNode(value: unknown): value is ESTree.Node {
  return (
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string"
  );
}

function createsTypeScope(node: ESTree.Node): boolean {
  return (
    node.type === "BlockStatement" ||
    node.type === "TSModuleBlock" ||
    node.type === "SwitchStatement" ||
    node.type === "StaticBlock" ||
    node.type === "ClassDeclaration" ||
    node.type === "ClassExpression"
  );
}

function createTypeBindings(): TypeBindings {
  return {
    aliases: new Map(),
    classes: new Map(),
    importEquals: new Map(),
    interfaces: new Map(),
    namespaces: new Map(),
    bindings: new Set(),
  };
}

function isExportedDeclaration(node: ESTree.Node, scope: TypeScope): boolean {
  if (scope.merged === null) return false;
  if (scope.ambient) return true;
  return (
    node.parent !== null &&
    node.parent.type === "ExportNamedDeclaration" &&
    node.parent.declaration === node
  );
}

function declarationBindings(node: ESTree.Node, scope: TypeScope): TypeBindings {
  return isExportedDeclaration(node, scope) && scope.merged !== null ? scope.merged : scope;
}

function addBinding(bindings: TypeBindings, name: string): void {
  bindings.bindings.add(name);
}

function collectDeclaration(node: ESTree.Node, scope: TypeScope): void {
  const bindings = declarationBindings(node, scope);
  switch (node.type) {
    case "ImportDeclaration":
      for (const specifier of node.specifiers) addBinding(scope, specifier.local.name);
      return;
    case "TSTypeAliasDeclaration":
      addBinding(bindings, node.id.name);
      bindings.aliases.set(node.id.name, node);
      return;
    case "TSInterfaceDeclaration": {
      addBinding(bindings, node.id.name);
      const declarations = bindings.interfaces.get(node.id.name) ?? [];
      declarations.push(node);
      bindings.interfaces.set(node.id.name, declarations);
      return;
    }
    case "ClassDeclaration":
      if (node.id !== null) {
        addBinding(bindings, node.id.name);
        const declarations = bindings.classes.get(node.id.name) ?? [];
        declarations.push(node);
        bindings.classes.set(node.id.name, declarations);
      }
      return;
    case "TSEnumDeclaration":
      addBinding(bindings, node.id.name);
      return;
    case "TSImportEqualsDeclaration": {
      addBinding(bindings, node.id.name);
      if (node.moduleReference.type === "TSExternalModuleReference") return;
      const target = qualifiedNameParts(node.moduleReference);
      if (target !== null) {
        bindings.importEquals.set(node.id.name, { declaration: node, target });
      }
      return;
    }
    case "TSModuleDeclaration":
      if (node.id.type === "Identifier") addBinding(bindings, node.id.name);
      return;
    default:
      return;
  }
}

function nearestBindings(
  name: string,
  useNode: ESTree.Node,
  scopes: WeakMap<ESTree.Node, TypeScope>,
  root: TypeScope,
): TypeBindings | null {
  let current: ESTree.Node | null = useNode;
  let scope: TypeScope | null = null;
  while (current !== null) {
    scope = scopes.get(current) ?? null;
    if (scope !== null) break;
    current = current.parent;
  }

  let candidate: TypeScope | null = scope ?? root;
  for (; candidate !== null; candidate = candidate.parent) {
    if (candidate.bindings.has(name)) return candidate;
    if (candidate.merged?.bindings.has(name) === true) return candidate.merged;
  }
  return null;
}

function qualifiedNameParts(
  name: ESTree.TSTypeName | ESTree.BindingIdentifier | ESTree.IdentifierName,
): string[] | null {
  if (name.type === "Identifier") return [name.name];
  if (name.type !== "TSQualifiedName") return null;

  const parts: string[] = [name.right.name];
  let current = name.left;
  while (current.type === "TSQualifiedName") {
    parts.push(current.right.name);
    current = current.left;
  }
  if (current.type !== "Identifier") return null;
  parts.push(current.name);
  return parts.reverse();
}

function namespaceNameParts(
  node: ESTree.TSModuleDeclaration | ESTree.TSGlobalDeclaration,
): string[] | null {
  if (node.id.type === "Literal") return [`module:${node.id.value}`];
  return qualifiedNameParts(node.id);
}

function qualifiedNamespaceBindings(
  path: readonly string[],
  useNode: ESTree.Node,
  scopes: WeakMap<ESTree.Node, TypeScope>,
  root: TypeScope,
): TypeBindings | null {
  const [owner, ...members] = path;
  if (owner === undefined || members.length === 0) return null;
  const ownerBindings = nearestBindings(owner, useNode, scopes, root);
  let namespace = ownerBindings?.namespaces.get(owner) ?? null;
  if (namespace === null) return null;

  for (const member of members.slice(0, -1)) {
    namespace = namespace.namespaces.get(member) ?? null;
    if (namespace === null) return null;
  }
  return namespace;
}

/** Build hoisted type bindings for every lexical block in a program. */
export function createLexicalTypeEnvironment(
  program: ESTree.Program,
  visitorKeys: VisitorKeys,
): LexicalTypeEnvironment {
  const cached = LEXICAL_ENVIRONMENTS.get(program);
  if (cached !== undefined) return cached;

  const scopes = new WeakMap<ESTree.Node, TypeScope>();
  const namespaceScopes = new WeakMap<ESTree.TSModuleBlock, NamespaceScope>();
  const mergedNamespaces = new Map<object, Map<string, TypeBindings>>();
  const rootMergeRoot = {};
  const root: TypeScope = {
    parent: null,
    ...createTypeBindings(),
    merged: null,
    namespacePath: null,
    mergeRoot: rootMergeRoot,
    ambient: false,
  };
  scopes.set(program, root);

  const mergedNamespaceBindings = (mergeRoot: object, path: string): TypeBindings => {
    let namespaces = mergedNamespaces.get(mergeRoot);
    if (namespaces === undefined) {
      namespaces = new Map();
      mergedNamespaces.set(mergeRoot, namespaces);
    }
    let bindings = namespaces.get(path);
    if (bindings === undefined) {
      bindings = createTypeBindings();
      namespaces.set(path, bindings);
    }
    return bindings;
  };

  const visit = (node: ESTree.Node, currentScope: TypeScope): void => {
    collectDeclaration(node, currentScope);

    if (node.type === "TSModuleDeclaration" && node.body !== null) {
      const names = namespaceNameParts(node);
      if (names !== null) {
        const mergeRoot =
          currentScope.merged === null || isExportedDeclaration(node, currentScope)
            ? currentScope.mergeRoot
            : currentScope;
        const pathParts =
          currentScope.namespacePath === null ? [] : currentScope.namespacePath.split(".");
        let bindings = declarationBindings(node, currentScope);
        for (const name of names) {
          pathParts.push(name);
          const namespace = mergedNamespaceBindings(mergeRoot, pathParts.join("."));
          if (!name.startsWith("module:")) addBinding(bindings, name);
          bindings.namespaces.set(name, namespace);
          bindings = namespace;
        }
        const path = pathParts.join(".");
        namespaceScopes.set(node.body, {
          bindings,
          path,
          mergeRoot,
          ambient: currentScope.ambient || node.declare,
        });
      }
    }

    let childScope = currentScope;
    if (node !== program && createsTypeScope(node)) {
      const namespace = node.type === "TSModuleBlock" ? namespaceScopes.get(node) : undefined;
      const mergeRoot = namespace?.mergeRoot ?? {};
      childScope = {
        parent: currentScope,
        ...createTypeBindings(),
        merged: namespace?.bindings ?? null,
        namespacePath: namespace?.path ?? null,
        mergeRoot,
        ambient: namespace?.ambient ?? false,
      };
      scopes.set(node, childScope);
      if (
        (node.type === "ClassDeclaration" || node.type === "ClassExpression") &&
        node.id !== null
      ) {
        addBinding(childScope, node.id.name);
        childScope.classes.set(node.id.name, [node]);
      }
    }

    const record = node as unknown as Readonly<Record<string, unknown>>;
    for (const key of visitorKeys[node.type] ?? []) {
      const value = record[key];
      if (isNode(value)) {
        visit(value, childScope);
        continue;
      }
      if (!Array.isArray(value)) continue;
      for (const child of value) {
        if (isNode(child)) visit(child, childScope);
      }
    }
  };

  visit(program, root);

  const importedBinding = (name: string, useNode: ESTree.Node): ImportEqualsBinding | null => {
    const bindings = nearestBindings(name, useNode, scopes, root);
    return bindings?.importEquals.get(name) ?? null;
  };

  const expandImportedPath = (
    path: readonly string[],
    useNode: ESTree.Node,
    visited: ReadonlySet<ESTree.TSImportEqualsDeclaration>,
  ): { readonly path: readonly string[]; readonly useNode: ESTree.Node } | null => {
    const [owner, ...members] = path;
    if (owner === undefined) return null;
    const imported = importedBinding(owner, useNode);
    if (imported === null) return { path, useNode };
    if (visited.has(imported.declaration)) return null;
    const nextVisited = new Set(visited);
    nextVisited.add(imported.declaration);
    return expandImportedPath(
      [...imported.target, ...members],
      imported.declaration.moduleReference,
      nextVisited,
    );
  };

  const lookupAlias = (
    name: string,
    useNode: ESTree.Node,
    visited: ReadonlySet<ESTree.TSImportEqualsDeclaration>,
  ): ESTree.TSTypeAliasDeclaration | null => {
    const bindings = nearestBindings(name, useNode, scopes, root);
    const alias = bindings?.aliases.get(name);
    if (alias !== undefined) return alias;
    const imported = bindings?.importEquals.get(name);
    if (imported === undefined || visited.has(imported.declaration)) return null;
    const nextVisited = new Set(visited);
    nextVisited.add(imported.declaration);
    return lookupAliasPath(imported.target, imported.declaration.moduleReference, nextVisited);
  };

  const lookupAliasPath = (
    path: readonly string[],
    useNode: ESTree.Node,
    visited: ReadonlySet<ESTree.TSImportEqualsDeclaration>,
  ): ESTree.TSTypeAliasDeclaration | null => {
    const expanded = expandImportedPath(path, useNode, visited);
    if (expanded === null) return null;
    const [owner] = expanded.path;
    if (owner === undefined) return null;
    if (expanded.path.length === 1) {
      return lookupAlias(owner, expanded.useNode, visited);
    }
    if (lexicalTypeParameterNames(expanded.useNode, visitorKeys).has(owner)) return null;
    const bindings = qualifiedNamespaceBindings(expanded.path, expanded.useNode, scopes, root);
    const aliasName = expanded.path.at(-1);
    return aliasName === undefined ? null : (bindings?.aliases.get(aliasName) ?? null);
  };

  const lookupDeclarations = <Declaration>(
    name: string,
    useNode: ESTree.Node,
    select: (bindings: TypeBindings, declarationName: string) => readonly Declaration[],
    visited: ReadonlySet<ESTree.TSImportEqualsDeclaration>,
  ): readonly Declaration[] => {
    const bindings = nearestBindings(name, useNode, scopes, root);
    const declarations = bindings === null ? [] : select(bindings, name);
    if (declarations.length > 0) return declarations;
    const imported = bindings?.importEquals.get(name);
    if (imported === undefined || visited.has(imported.declaration)) return [];
    const nextVisited = new Set(visited);
    nextVisited.add(imported.declaration);
    return lookupDeclarationPath(
      imported.target,
      imported.declaration.moduleReference,
      select,
      nextVisited,
    );
  };

  const lookupDeclarationPath = <Declaration>(
    path: readonly string[],
    useNode: ESTree.Node,
    select: (bindings: TypeBindings, declarationName: string) => readonly Declaration[],
    visited: ReadonlySet<ESTree.TSImportEqualsDeclaration>,
  ): readonly Declaration[] => {
    const expanded = expandImportedPath(path, useNode, visited);
    if (expanded === null) return [];
    const [owner] = expanded.path;
    if (owner === undefined) return [];
    if (expanded.path.length === 1) {
      return lookupDeclarations(owner, expanded.useNode, select, visited);
    }
    if (lexicalTypeParameterNames(expanded.useNode, visitorKeys).has(owner)) return [];
    const bindings = qualifiedNamespaceBindings(expanded.path, expanded.useNode, scopes, root);
    const declarationName = expanded.path.at(-1);
    return bindings === null || declarationName === undefined
      ? []
      : select(bindings, declarationName);
  };

  const selectInterfaces = (bindings: TypeBindings, name: string) =>
    bindings.interfaces.get(name) ?? [];
  const selectClasses = (bindings: TypeBindings, name: string) => bindings.classes.get(name) ?? [];

  const environment: LexicalTypeEnvironment = {
    lookupAlias(name, useNode) {
      return lookupAlias(name, useNode, new Set());
    },
    lookupQualifiedAlias(path, useNode) {
      return lookupAliasPath(path, useNode, new Set());
    },
    lookupInterfaces(name, useNode) {
      return lookupDeclarations(name, useNode, selectInterfaces, new Set());
    },
    lookupQualifiedInterfaces(path, useNode) {
      return lookupDeclarationPath(path, useNode, selectInterfaces, new Set());
    },
    lookupClasses(name, useNode) {
      return lookupDeclarations(name, useNode, selectClasses, new Set());
    },
    lookupQualifiedClasses(path, useNode) {
      return lookupDeclarationPath(path, useNode, selectClasses, new Set());
    },
    hasTypeParameter(name, useNode) {
      return lexicalTypeParameterNames(useNode, visitorKeys).has(name);
    },
    isBuiltInType(name, useNode) {
      return (
        !lexicalTypeParameterNames(useNode, visitorKeys).has(name) &&
        nearestBindings(name, useNode, scopes, root) === null
      );
    },
    isBuiltInTypeReference(type, name) {
      const path = typeReferencePath(type);
      if (path?.length === 1 && path[0] === name) {
        return environment.isBuiltInType(name, type);
      }
      if (path?.length !== 2 || path[0] !== "globalThis" || path[1] !== name) {
        return false;
      }
      return (
        !lexicalTypeParameterNames(type, visitorKeys).has("globalThis") &&
        nearestBindings("globalThis", type, scopes, root) === null
      );
    },
  };
  RESOLUTION_IDENTITIES.set(environment, {
    aliasIdentities: new WeakMap(),
    nodeIds: new WeakMap(),
    nextNodeId: 1,
  });
  LEXICAL_ENVIRONMENTS.set(program, environment);
  return environment;
}

function typeReferencePath(type: ESTree.TSTypeReference): string[] | null {
  return qualifiedNameParts(type.typeName);
}

function typeReferenceName(type: ESTree.TSTypeReference): string | null {
  const path = typeReferencePath(type);
  return path?.length === 1 ? (path[0] ?? null) : null;
}

function bindAliasTypeParameters(
  alias: ESTree.TSTypeAliasDeclaration,
  reference: ESTree.TSTypeReference,
  callerSubstitutions: TypeSubstitutions,
): TypeSubstitutions | null {
  const parameters = alias.typeParameters?.params ?? [];
  const arguments_ = reference.typeArguments?.params ?? [];
  if (arguments_.length > parameters.length) return null;

  const calleeSubstitutions = new Map<string, TypeSubstitution>();
  for (const [index, parameter] of parameters.entries()) {
    const argument = arguments_[index];
    if (argument !== undefined) {
      // Explicit arguments belong to the caller, before callee parameter names exist.
      calleeSubstitutions.set(parameter.name.name, {
        type: argument,
        substitutions: callerSubstitutions,
      });
      continue;
    }
    if (parameter.default === null) return null;
    // Defaults can reference parameters already bound by this alias.
    calleeSubstitutions.set(parameter.name.name, {
      type: parameter.default,
      substitutions: new Map(calleeSubstitutions),
    });
  }
  return calleeSubstitutions;
}

function resolutionIdentityStore(environment: LexicalTypeEnvironment): ResolutionIdentityStore {
  let store = RESOLUTION_IDENTITIES.get(environment);
  if (store === undefined) {
    store = {
      aliasIdentities: new WeakMap(),
      nodeIds: new WeakMap(),
      nextNodeId: 1,
    };
    RESOLUTION_IDENTITIES.set(environment, store);
  }
  return store;
}

function nodeIdentity(node: object, store: ResolutionIdentityStore): number {
  let identity = store.nodeIds.get(node);
  if (identity === undefined) {
    identity = store.nextNodeId;
    store.nextNodeId += 1;
    store.nodeIds.set(node, identity);
  }
  return identity;
}

function typeStateKey(
  type: TypeStateInput,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  store: ResolutionIdentityStore,
  depth = 0,
  resolvingSubstitutions: ReadonlySet<TypeSubstitution> = new Set(),
): string {
  if (depth >= MAX_TYPE_STATE_DEPTH) {
    return `terminal:${type.type}:${nodeIdentity(type, store)}`;
  }
  const nextDepth = depth + 1;

  switch (type.type) {
    case "TSParenthesizedType":
    case "TSOptionalType":
    case "TSRestType":
      return typeStateKey(
        type.typeAnnotation,
        environment,
        substitutions,
        store,
        nextDepth,
        resolvingSubstitutions,
      );
    case "TSArrayType":
      return `array:${typeStateKey(
        type.elementType,
        environment,
        substitutions,
        store,
        nextDepth,
        resolvingSubstitutions,
      )}`;
    case "TSNamedTupleMember":
      return `named:${typeStateKey(
        type.elementType,
        environment,
        substitutions,
        store,
        nextDepth,
        resolvingSubstitutions,
      )}`;
    case "TSTupleType":
      return `tuple:${type.elementTypes
        .map((member) =>
          typeStateKey(
            member,
            environment,
            substitutions,
            store,
            nextDepth,
            resolvingSubstitutions,
          ),
        )
        .join(",")}`;
    case "TSUnionType":
    case "TSIntersectionType":
      return `${type.type}:${type.types
        .map((member) =>
          typeStateKey(
            member,
            environment,
            substitutions,
            store,
            nextDepth,
            resolvingSubstitutions,
          ),
        )
        .join(",")}`;
    case "TSTypeOperator":
      return `${type.operator}:${typeStateKey(
        type.typeAnnotation,
        environment,
        substitutions,
        store,
        nextDepth,
        resolvingSubstitutions,
      )}`;
    case "TSIndexedAccessType":
      return `indexed:${typeStateKey(
        type.objectType,
        environment,
        substitutions,
        store,
        nextDepth,
        resolvingSubstitutions,
      )}:${typeStateKey(
        type.indexType,
        environment,
        substitutions,
        store,
        nextDepth,
        resolvingSubstitutions,
      )}`;
    case "TSConditionalType":
      return `conditional:${[type.checkType, type.extendsType, type.trueType, type.falseType]
        .map((member) =>
          typeStateKey(
            member,
            environment,
            substitutions,
            store,
            nextDepth,
            resolvingSubstitutions,
          ),
        )
        .join(":")}`;
    case "TSTypeReference": {
      const path = typeReferencePath(type);
      if (path === null) return `qualified:${nodeIdentity(type.typeName, store)}`;
      const name = path.length === 1 ? (path[0] ?? null) : null;
      const arguments_ = type.typeArguments?.params ?? [];
      if (name !== null) {
        const substitution = substitutions.get(name);
        if (substitution !== undefined && arguments_.length === 0) {
          if (resolvingSubstitutions.has(substitution)) {
            return `substitution-cycle:${nodeIdentity(substitution, store)}`;
          }
          const nextResolving = new Set(resolvingSubstitutions);
          nextResolving.add(substitution);
          return typeStateKey(
            substitution.type,
            environment,
            substitution.substitutions,
            store,
            nextDepth,
            nextResolving,
          );
        }
      }

      const alias =
        name === null
          ? environment.lookupQualifiedAlias(path, type)
          : environment.lookupAlias(name, type);
      const target =
        alias !== null
          ? `alias:${nodeIdentity(alias, store)}`
          : name !== null && environment.hasTypeParameter(name, type)
            ? `parameter:${name}`
            : name !== null && environment.isBuiltInType(name, type)
              ? `built-in:${name}`
              : `binding:${path.join(".")}:${nodeIdentity(type.typeName, store)}`;
      return `${target}<${arguments_
        .map((argument) =>
          typeStateKey(
            argument,
            environment,
            substitutions,
            store,
            nextDepth,
            resolvingSubstitutions,
          ),
        )
        .join(",")}>`;
    }
    default:
      return `${type.type}:${nodeIdentity(type, store)}`;
  }
}

function aliasResolutionIdentity(
  alias: ESTree.TSTypeAliasDeclaration,
  substitutions: TypeSubstitutions,
  environment: LexicalTypeEnvironment,
): TypeSubstitution {
  const store = resolutionIdentityStore(environment);
  const key = (alias.typeParameters?.params ?? [])
    .map((parameter) => {
      const substitution = substitutions.get(parameter.name.name);
      return substitution === undefined
        ? "missing"
        : typeStateKey(substitution.type, environment, substitution.substitutions, store);
    })
    .join("|");
  let identities = store.aliasIdentities.get(alias);
  if (identities === undefined) {
    identities = new Map();
    store.aliasIdentities.set(alias, identities);
  }
  let identity = identities.get(key);
  if (identity === undefined) {
    identity = { type: alias.typeAnnotation, substitutions };
    identities.set(key, identity);
  }
  return identity;
}

/** Resolve a local type reference through substitutions and the nearest alias binding. */
export function resolveTypeReference(
  type: ESTree.TSTypeReference,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions = EMPTY_SUBSTITUTIONS,
): ResolvedTypeReference | null {
  const path = typeReferencePath(type);
  if (path === null) return null;
  const name = path.length === 1 ? (path[0] ?? null) : null;

  const arguments_ = type.typeArguments?.params ?? [];
  if (name !== null) {
    const substitution = substitutions.get(name);
    if (substitution !== undefined && arguments_.length === 0) {
      return { ...substitution, declaration: null, identity: substitution };
    }
    if (environment.hasTypeParameter(name, type)) return null;
  }

  const alias =
    name === null
      ? environment.lookupQualifiedAlias(path, type)
      : environment.lookupAlias(name, type);
  if (alias === null) return null;
  const aliasSubstitutions = bindAliasTypeParameters(alias, type, substitutions);
  if (aliasSubstitutions === null) return null;
  return {
    type: alias.typeAnnotation,
    substitutions: aliasSubstitutions,
    declaration: alias,
    identity: aliasResolutionIdentity(alias, aliasSubstitutions, environment),
  };
}

function typeReferenceIs(
  type: ESTree.TSType,
  name: string,
  environment: LexicalTypeEnvironment,
): boolean {
  return type.type === "TSTypeReference" && environment.isBuiltInTypeReference(type, name);
}

function resolvesToUnknownInternal(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  options: UnknownResolutionOptions,
  substitutions: TypeSubstitutions,
  visited: ReadonlySet<object>,
): boolean {
  if (type.type === "TSUnknownKeyword") return true;
  if (type.type === "TSParenthesizedType") {
    return resolvesToUnknownInternal(
      type.typeAnnotation,
      environment,
      options,
      substitutions,
      visited,
    );
  }
  if (type.type === "TSUnionType") {
    return type.types.some((member) =>
      resolvesToUnknownInternal(member, environment, options, substitutions, visited),
    );
  }
  if (type.type === "TSTypeReference" && typeReferenceIs(type, "Awaited", environment)) {
    const value = type.typeArguments?.params[0];
    return (
      value !== undefined &&
      resolvesToUnknownInternal(
        value,
        environment,
        { ...options, unwrapPromises: true },
        substitutions,
        visited,
      )
    );
  }
  if (
    type.type === "TSTypeReference" &&
    options.unwrapPromises === true &&
    (typeReferenceIs(type, "Promise", environment) ||
      typeReferenceIs(type, "PromiseLike", environment))
  ) {
    const value = type.typeArguments?.params[0];
    return (
      value !== undefined &&
      resolvesToUnknownInternal(value, environment, options, substitutions, visited)
    );
  }
  if (type.type !== "TSTypeReference") return false;

  const resolved = resolveTypeReference(type, environment, substitutions);
  if (resolved === null || visited.has(resolved.identity)) return false;
  const nextVisited = new Set(visited);
  nextVisited.add(resolved.identity);
  return resolvesToUnknownInternal(
    resolved.type,
    environment,
    options,
    resolved.substitutions,
    nextVisited,
  );
}

/** Return whether a type resolves to unknown at its lexical use site. */
export function resolvesToUnknown(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  options: UnknownResolutionOptions = {},
): boolean {
  return resolvesToUnknownInternal(type, environment, options, EMPTY_SUBSTITUTIONS, new Set());
}

function resolvesToNeverType(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  substitutions: TypeSubstitutions,
  visited: ReadonlySet<object>,
): boolean {
  if (type.type === "TSNeverKeyword") return true;
  if (type.type === "TSParenthesizedType") {
    return resolvesToNeverType(type.typeAnnotation, environment, substitutions, visited);
  }
  if (type.type === "TSUnionType") {
    return (
      type.types.length > 0 &&
      type.types.every((member) => resolvesToNeverType(member, environment, substitutions, visited))
    );
  }
  if (type.type === "TSIntersectionType") {
    return type.types.some((member) =>
      resolvesToNeverType(member, environment, substitutions, visited),
    );
  }
  if (type.type !== "TSTypeReference") return false;

  const resolved = resolveTypeReference(type, environment, substitutions);
  if (resolved === null || visited.has(resolved.identity)) return false;
  const nextVisited = new Set(visited);
  nextVisited.add(resolved.identity);
  return resolvesToNeverType(resolved.type, environment, resolved.substitutions, nextVisited);
}

function isEffectivelyEmptyObjectType(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  options: ObjectResolutionOptions,
  substitutions: TypeSubstitutions,
  visited: ReadonlySet<object>,
): boolean {
  if (type.type === "TSUnknownKeyword") return true;
  if (type.type === "TSParenthesizedType") {
    return isEffectivelyEmptyObjectType(
      type.typeAnnotation,
      environment,
      options,
      substitutions,
      visited,
    );
  }
  if (type.type === "TSTypeLiteral") return type.members.length === 0;
  if (type.type === "TSMappedType") {
    return resolvesToNeverType(type.constraint, environment, substitutions, visited);
  }
  if (type.type === "TSIntersectionType") {
    return type.types.every((member) =>
      isEffectivelyEmptyObjectType(member, environment, options, substitutions, visited),
    );
  }
  if (type.type !== "TSTypeReference") return false;

  if (typeReferenceIs(type, "Awaited", environment)) {
    const value = type.typeArguments?.params[0];
    return (
      value !== undefined &&
      isEffectivelyEmptyObjectType(
        value,
        environment,
        { ...options, unwrapPromises: true },
        substitutions,
        visited,
      )
    );
  }
  if (
    options.unwrapPromises === true &&
    (typeReferenceIs(type, "Promise", environment) ||
      typeReferenceIs(type, "PromiseLike", environment))
  ) {
    const value = type.typeArguments?.params[0];
    return (
      value !== undefined &&
      isEffectivelyEmptyObjectType(value, environment, options, substitutions, visited)
    );
  }

  const name = typeReferenceName(type);
  if (
    name !== null &&
    (name === "Pick" || name === "Record") &&
    environment.isBuiltInType(name, type)
  ) {
    const key = type.typeArguments?.params[name === "Record" ? 0 : 1];
    return key !== undefined && resolvesToNeverType(key, environment, substitutions, visited);
  }
  if (
    name !== null &&
    OBJECT_TRANSPARENT_WRAPPERS.has(name) &&
    environment.isBuiltInType(name, type)
  ) {
    const wrapped = type.typeArguments?.params[0];
    return (
      wrapped !== undefined &&
      isEffectivelyEmptyObjectType(wrapped, environment, options, substitutions, visited)
    );
  }

  const resolved = resolveTypeReference(type, environment, substitutions);
  if (resolved === null || visited.has(resolved.identity)) return false;
  const nextVisited = new Set(visited);
  nextVisited.add(resolved.identity);
  return isEffectivelyEmptyObjectType(
    resolved.type,
    environment,
    options,
    resolved.substitutions,
    nextVisited,
  );
}

function resolvesToObjectInternal(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
  options: ObjectResolutionOptions,
  substitutions: TypeSubstitutions,
  visited: ReadonlySet<object>,
): boolean {
  if (type.type === "TSObjectKeyword") return true;
  if (type.type === "TSParenthesizedType") {
    return resolvesToObjectInternal(
      type.typeAnnotation,
      environment,
      options,
      substitutions,
      visited,
    );
  }
  if (type.type === "TSUnionType") {
    return type.types.some((member) =>
      resolvesToObjectInternal(member, environment, options, substitutions, visited),
    );
  }
  if (type.type === "TSIntersectionType") {
    let containsObject = false;
    for (const member of type.types) {
      if (resolvesToObjectInternal(member, environment, options, substitutions, visited)) {
        containsObject = true;
        continue;
      }
      if (!isEffectivelyEmptyObjectType(member, environment, options, substitutions, visited)) {
        return false;
      }
    }
    return containsObject;
  }
  if (type.type !== "TSTypeReference") return false;

  if (typeReferenceIs(type, "Awaited", environment)) {
    const value = type.typeArguments?.params[0];
    return (
      value !== undefined &&
      resolvesToObjectInternal(
        value,
        environment,
        { ...options, unwrapPromises: true },
        substitutions,
        visited,
      )
    );
  }
  if (
    options.unwrapPromises === true &&
    (typeReferenceIs(type, "Promise", environment) ||
      typeReferenceIs(type, "PromiseLike", environment))
  ) {
    const value = type.typeArguments?.params[0];
    return (
      value !== undefined &&
      resolvesToObjectInternal(value, environment, options, substitutions, visited)
    );
  }

  const name = typeReferenceName(type);
  if (
    name !== null &&
    OBJECT_TRANSPARENT_WRAPPERS.has(name) &&
    environment.isBuiltInType(name, type)
  ) {
    const wrapped = type.typeArguments?.params[0];
    return (
      wrapped !== undefined &&
      resolvesToObjectInternal(wrapped, environment, options, substitutions, visited)
    );
  }

  const resolved = resolveTypeReference(type, environment, substitutions);
  if (resolved === null || visited.has(resolved.identity)) return false;
  const nextVisited = new Set(visited);
  nextVisited.add(resolved.identity);
  return resolvesToObjectInternal(
    resolved.type,
    environment,
    options,
    resolved.substitutions,
    nextVisited,
  );
}

/** Return whether a type resolves to the broad object type at its lexical use site. */
export function resolvesToObject(
  type: ESTree.TSType,
  environment: LexicalTypeEnvironment,
): boolean {
  return resolvesToObjectInternal(type, environment, {}, EMPTY_SUBSTITUTIONS, new Set());
}
