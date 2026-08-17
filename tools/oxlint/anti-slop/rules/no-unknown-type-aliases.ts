import type { ESTree } from "@oxlint/plugins";

import { defineRule } from "@oxlint/plugins";

import { createLexicalTypeEnvironment, resolvesToUnknown } from "../shared/type-environment.ts";

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
    let environment: ReturnType<typeof createLexicalTypeEnvironment> | null = null;

    return {
      Program(node) {
        environment = createLexicalTypeEnvironment(node, context.sourceCode.visitorKeys);
      },
      TSTypeAliasDeclaration(node: ESTree.TSTypeAliasDeclaration) {
        if (environment === null || !resolvesToUnknown(node.typeAnnotation, environment)) {
          return;
        }
        context.report({
          node: node.id,
          messageId: "unknownAlias",
          data: { alias: node.id.name },
        });
      },
    };
  },
});
