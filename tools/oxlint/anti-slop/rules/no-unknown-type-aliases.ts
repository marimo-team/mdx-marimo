import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

import {
	resolveTypeAliasApplication,
	resolveTypeSubstitution,
	type TypeSubstitutions,
} from "../shared/scope.ts";

/** Ban named aliases that merely conceal TypeScript's unknown top type. */
export const noUnknownTypeAliasesRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow type aliases whose resolved type is unknown; unknown must remain visible at an allowed boundary.",
		},
		messages: {
			unknownAlias:
				"Type alias `{{alias}}` hides `unknown`. Keep `unknown` explicit at the parsing boundary or on an allowed `cause` field; otherwise use the parsed owner type.",
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
			if (type.type === "TSParenthesizedType")
				return resolvesToUnknown(type.typeAnnotation, substitutions, visited, resolvingParameters);
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

		return {
			TSTypeAliasDeclaration(alias) {
				if (!resolvesToUnknown(alias.typeAnnotation, new Map(), new Set([alias]))) return;
				context.report({
					node: alias.id,
					messageId: "unknownAlias",
					data: { alias: alias.id.name },
				});
			},
		};
	},
});
