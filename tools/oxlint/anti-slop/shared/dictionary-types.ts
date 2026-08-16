import type { ESTree, SourceCode } from "@oxlint/plugins";

import {
	isGlobalTypeReference,
	resolveInterfaces,
	resolveTypeAliasApplication,
	resolveTypeSubstitution,
	type TypeSubstitutions,
} from "./scope.ts";

const TRANSPARENT_WRAPPERS = new Set(["Readonly", "Partial", "Required", "NonNullable"]);

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
	| "generic container"
	| "object"
	| "open dictionary"
	| "unknown";

export type WideningTarget = {
	readonly kind: WideningTargetKind;
};

export type TypeEnvironment = {
	readonly sourceCode: SourceCode;
};

export function createTypeEnvironment(sourceCode: SourceCode): TypeEnvironment {
	return { sourceCode };
}

function typeReferenceName(type: ESTree.TSTypeReference): string | null {
	return type.typeName.type === "Identifier" ? type.typeName.name : null;
}

function isBuiltIn(
	type: ESTree.TSTypeReference,
	name: string,
	environment: TypeEnvironment,
): boolean {
	return isGlobalTypeReference(environment.sourceCode, type, name);
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

function isEffectivelyEmptyInterface(
	declarations: readonly ESTree.TSInterfaceDeclaration[],
): boolean {
	return (
		declarations.length > 0 &&
		declarations.every(
			(declaration) =>
				declaration.extends.length === 0 && declaration.body.body.every(isEffectivelyEmptyMember),
		)
	);
}

function unsafeDirectValue(
	type: ESTree.TSType,
	environment: TypeEnvironment,
	substitutions: TypeSubstitutions,
	resolvingAliases: ReadonlySet<ESTree.TSTypeAliasDeclaration>,
	resolvingParameters: ReadonlySet<ESTree.TSTypeParameter>,
): UnsafeDictionary["unsafeValue"] | null {
	const unwrapped = unwrapTransparentType(type);
	if (unwrapped.type === "TSUnknownKeyword") return "unknown";
	if (unwrapped.type === "TSAnyKeyword") return "any";
	if (unwrapped.type === "TSObjectKeyword") return "object";
	if (unwrapped.type === "TSTypeLiteral" && isEffectivelyEmptyTypeLiteral(unwrapped))
		return "empty-object";
	if (unwrapped.type === "TSUnionType") {
		return unwrapped.types.some(
			(member) =>
				unsafeDirectValue(
					member,
					environment,
					substitutions,
					resolvingAliases,
					resolvingParameters,
				) !== null,
		)
			? "union"
			: null;
	}
	if (unwrapped.type === "TSIntersectionType") {
		const unsafeMembers = unwrapped.types.map((member) =>
			unsafeDirectValue(member, environment, substitutions, resolvingAliases, resolvingParameters),
		);
		if (unsafeMembers.includes("any")) return "any";
		const [firstUnsafeMember] = unsafeMembers;
		return firstUnsafeMember !== undefined && unsafeMembers.every((member) => member !== null)
			? firstUnsafeMember
			: null;
	}
	if (unwrapped.type !== "TSTypeReference") return null;
	const name = typeReferenceName(unwrapped);
	if (name === null) return null;
	if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(unwrapped, name, environment)) {
		const wrapped = unwrapped.typeArguments?.params[0];
		return wrapped === undefined
			? null
			: unsafeDirectValue(
					wrapped,
					environment,
					substitutions,
					resolvingAliases,
					resolvingParameters,
				);
	}
	const substitution = resolveTypeSubstitution(environment.sourceCode, unwrapped, substitutions);
	if (substitution !== null) {
		if (resolvingParameters.has(substitution.parameter)) return null;
		const nextResolvingParameters = new Set(resolvingParameters);
		nextResolvingParameters.add(substitution.parameter);
		return unsafeDirectValue(
			substitution.type,
			environment,
			substitutions,
			resolvingAliases,
			nextResolvingParameters,
		);
	}
	const interfaceDeclarations = resolveInterfaces(environment.sourceCode, unwrapped);
	if (interfaceDeclarations.length > 0) {
		return isEffectivelyEmptyInterface(interfaceDeclarations) ? "empty-object" : null;
	}
	const application = resolveTypeAliasApplication(environment.sourceCode, unwrapped, substitutions);
	if (application === null || resolvingAliases.has(application.alias)) return null;
	const nextResolving = new Set(resolvingAliases);
	nextResolving.add(application.alias);
	return unsafeDirectValue(
		application.alias.typeAnnotation,
		environment,
		application.substitutions,
		nextResolving,
		resolvingParameters,
	);
}

function dictionaryValueTypes(
	type: ESTree.TSType,
	environment: TypeEnvironment,
	substitutions: TypeSubstitutions,
	resolvingAliases: ReadonlySet<ESTree.TSTypeAliasDeclaration>,
	resolvingParameters: ReadonlySet<ESTree.TSTypeParameter>,
): readonly ResolvedType[] {
	const unwrapped = unwrapTransparentType(type);

	if (unwrapped.type === "TSTypeLiteral") {
		return unwrapped.members.flatMap((member): readonly ResolvedType[] =>
			member.type === "TSIndexSignature" && member.typeAnnotation !== null
				? [{ type: member.typeAnnotation.typeAnnotation, substitutions }]
				: [],
		);
	}

	if (unwrapped.type === "TSMappedType") {
		return unwrapped.typeAnnotation === null
			? []
			: [{ type: unwrapped.typeAnnotation, substitutions }];
	}

	if (unwrapped.type !== "TSTypeReference") return [];
	const name = typeReferenceName(unwrapped);
	if (name === null) return [];

	const substitution = resolveTypeSubstitution(environment.sourceCode, unwrapped, substitutions);
	if (substitution !== null) {
		if (resolvingParameters.has(substitution.parameter)) return [];
		const nextResolvingParameters = new Set(resolvingParameters);
		nextResolvingParameters.add(substitution.parameter);
		return dictionaryValueTypes(
			substitution.type,
			environment,
			substitutions,
			resolvingAliases,
			nextResolvingParameters,
		);
	}

	if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(unwrapped, name, environment)) {
		const wrapped = unwrapped.typeArguments?.params[0];
		return wrapped === undefined
			? []
			: dictionaryValueTypes(
					wrapped,
					environment,
					substitutions,
					resolvingAliases,
					resolvingParameters,
				);
	}

	if (name === "Record" && isBuiltIn(unwrapped, name, environment)) {
		const value = unwrapped.typeArguments?.params[1] ?? null;
		return value === null ? [] : [{ type: value, substitutions }];
	}

	if ((name === "Pick" || name === "Omit") && isBuiltIn(unwrapped, name, environment)) {
		const source = unwrapped.typeArguments?.params[0];
		return source === undefined
			? []
			: dictionaryValueTypes(
					source,
					environment,
					substitutions,
					resolvingAliases,
					resolvingParameters,
				);
	}

	const application = resolveTypeAliasApplication(environment.sourceCode, unwrapped, substitutions);
	if (application === null || resolvingAliases.has(application.alias)) return [];
	const nextResolving = new Set(resolvingAliases);
	nextResolving.add(application.alias);
	return dictionaryValueTypes(
		application.alias.typeAnnotation,
		environment,
		application.substitutions,
		nextResolving,
		resolvingParameters,
	);
}

export function classifyUnsafeDictionaryValue(
	valueType: ESTree.TSType,
	environment: TypeEnvironment,
): UnsafeDictionary | null {
	const unsafeValue = unsafeDirectValue(valueType, environment, new Map(), new Set(), new Set());
	return unsafeValue === null ? null : { kind: "unsafe-dictionary", unsafeValue };
}

export function classifyUnsafeDictionary(
	type: ESTree.TSType,
	environment: TypeEnvironment,
): UnsafeDictionary | null {
	for (const valueType of dictionaryValueTypes(
		type,
		environment,
		new Map(),
		new Set(),
		new Set(),
	)) {
		const unsafeValue = unsafeDirectValue(
			valueType.type,
			environment,
			valueType.substitutions,
			new Set(),
			new Set(),
		);
		if (unsafeValue !== null) return { kind: "unsafe-dictionary", unsafeValue };
	}
	return null;
}

export function classifyWideningTarget(
	type: ESTree.TSType,
	environment: TypeEnvironment,
): WideningTarget | null {
	const unwrapped = unwrapTransparentType(type);
	if (unwrapped.type === "TSUnknownKeyword") return { kind: "unknown" };
	if (unwrapped.type === "TSObjectKeyword") return { kind: "object" };
	if (unwrapped.type === "TSTypeLiteral") {
		return unwrapped.members.some((member) => member.type === "TSIndexSignature")
			? { kind: "open dictionary" }
			: unwrapped.members.length > 0
				? { kind: "anonymous object" }
				: null;
	}
	if (unwrapped.type === "TSMappedType") {
		return isBroadMappedKey(unwrapped.constraint, environment, new Map(), new Set())
			? { kind: "open dictionary" }
			: { kind: "anonymous object" };
	}
	if (unwrapped.type !== "TSTypeReference") return null;
	const name = typeReferenceName(unwrapped);
	if (name === null) return null;
	if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(unwrapped, name, environment)) {
		const wrapped = unwrapped.typeArguments?.params[0];
		return wrapped === undefined ? null : classifyWideningTarget(wrapped, environment);
	}
	if (name === "Record" && isBuiltIn(unwrapped, name, environment)) {
		const key = unwrapped.typeArguments?.params[0];
		if (key === undefined) return null;
		return isBroadMappedKey(key, environment, new Map(), new Set())
			? { kind: "open dictionary" }
			: { kind: "anonymous object" };
	}
	const application = resolveTypeAliasApplication(environment.sourceCode, unwrapped, new Map());
	if (application === null) return null;
	const resolved = classifyAliasBroadTarget(
		application.alias.typeAnnotation,
		environment,
		application.substitutions,
		new Set([application.alias]),
		new Set(),
	);
	return (application.alias.typeParameters?.params.length ?? 0) > 0 &&
		resolved?.kind === "open dictionary"
		? { kind: "generic container" }
		: resolved;
}

function isBroadMappedKey(
	type: ESTree.TSType,
	environment: TypeEnvironment,
	substitutions: TypeSubstitutions,
	resolvingParameters: ReadonlySet<ESTree.TSTypeParameter>,
): boolean {
	const unwrapped = unwrapTransparentType(type);
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
		unwrapTransparentType(unwrapped.typeAnnotation).type === "TSAnyKeyword"
	) {
		return true;
	}
	if (unwrapped.type === "TSUnionType") {
		return unwrapped.types.some((member) =>
			isBroadMappedKey(member, environment, substitutions, resolvingParameters),
		);
	}
	if (unwrapped.type !== "TSTypeReference") return false;
	const name = typeReferenceName(unwrapped);
	if (name === null) return false;
	const substitution = resolveTypeSubstitution(environment.sourceCode, unwrapped, substitutions);
	if (substitution !== null) {
		if (resolvingParameters.has(substitution.parameter)) return false;
		const nextResolvingParameters = new Set(resolvingParameters);
		nextResolvingParameters.add(substitution.parameter);
		return isBroadMappedKey(substitution.type, environment, substitutions, nextResolvingParameters);
	}
	return name === "PropertyKey" && isBuiltIn(unwrapped, name, environment);
}

function classifyAliasBroadTarget(
	type: ESTree.TSType,
	environment: TypeEnvironment,
	substitutions: TypeSubstitutions,
	resolvingAliases: ReadonlySet<ESTree.TSTypeAliasDeclaration>,
	resolvingParameters: ReadonlySet<ESTree.TSTypeParameter>,
): WideningTarget | null {
	const unwrapped = unwrapTransparentType(type);
	if (unwrapped.type === "TSUnknownKeyword") return { kind: "unknown" };
	if (unwrapped.type === "TSObjectKeyword") return { kind: "object" };
	if (unwrapped.type === "TSTypeLiteral") {
		return unwrapped.members.some((member) => member.type === "TSIndexSignature")
			? { kind: "open dictionary" }
			: null;
	}
	if (unwrapped.type === "TSMappedType") {
		return isBroadMappedKey(unwrapped.constraint, environment, substitutions, resolvingParameters)
			? { kind: "open dictionary" }
			: { kind: "anonymous object" };
	}
	if (unwrapped.type !== "TSTypeReference") return null;
	const name = typeReferenceName(unwrapped);
	if (name === null) return null;
	const substitution = resolveTypeSubstitution(environment.sourceCode, unwrapped, substitutions);
	if (substitution !== null) {
		if (resolvingParameters.has(substitution.parameter)) return null;
		const nextResolvingParameters = new Set(resolvingParameters);
		nextResolvingParameters.add(substitution.parameter);
		return classifyAliasBroadTarget(
			substitution.type,
			environment,
			substitutions,
			resolvingAliases,
			nextResolvingParameters,
		);
	}
	if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(unwrapped, name, environment)) {
		const wrapped = unwrapped.typeArguments?.params[0];
		return wrapped === undefined
			? null
			: classifyAliasBroadTarget(
					wrapped,
					environment,
					substitutions,
					resolvingAliases,
					resolvingParameters,
				);
	}
	if (name === "Record" && isBuiltIn(unwrapped, name, environment)) {
		const key = unwrapped.typeArguments?.params[0];
		if (key === undefined) return null;
		return isBroadMappedKey(key, environment, substitutions, resolvingParameters)
			? { kind: "open dictionary" }
			: { kind: "anonymous object" };
	}
	const application = resolveTypeAliasApplication(environment.sourceCode, unwrapped, substitutions);
	if (application === null || resolvingAliases.has(application.alias)) return null;
	const nextResolving = new Set(resolvingAliases);
	nextResolving.add(application.alias);
	return classifyAliasBroadTarget(
		application.alias.typeAnnotation,
		environment,
		application.substitutions,
		nextResolving,
		resolvingParameters,
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
	if (current.type === "ObjectExpression") return true;
	return (
		current.type === "ArrayExpression" ||
		current.type === "ArrowFunctionExpression" ||
		current.type === "ClassExpression" ||
		current.type === "FunctionExpression" ||
		current.type === "NewExpression" ||
		current.type === "Literal" ||
		current.type === "TemplateLiteral" ||
		current.type === "UnaryExpression"
	);
}
