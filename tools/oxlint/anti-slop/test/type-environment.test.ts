import type { ESTree } from "@oxlint/plugins";

import { defineRule } from "@oxlint/plugins";

import { createLexicalTypeEnvironment } from "../shared/type-environment.ts";
import { ruleTester } from "./rule-tester.ts";

function qualifiedPath(name: ESTree.TSTypeName): string[] | null {
  if (name.type === "Identifier") return [name.name];
  if (name.type !== "TSQualifiedName") return null;
  const parent = qualifiedPath(name.left);
  return parent === null ? null : [...parent, name.right.name];
}

const qualifiedInterfacesRule = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Exercise qualified interface lookup." },
    messages: { resolved: "Resolved a local qualified interface." },
  },
  createOnce(context) {
    let environment: ReturnType<typeof createLexicalTypeEnvironment> | null = null;

    return {
      Program(node) {
        environment = createLexicalTypeEnvironment(node, context.sourceCode.visitorKeys);
      },
      TSTypeReference(node) {
        if (environment === null) return;
        const path = qualifiedPath(node.typeName);
        if (path === null || path.length < 2) return;
        for (const declaration of environment.lookupQualifiedInterfaces(path, node)) {
          context.report({ node: declaration.id, messageId: "resolved" });
        }
      },
    };
  },
});

const resolved = { messageId: "resolved" };

const cachedEnvironmentRule = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Exercise lexical environment reuse." },
    messages: { reused: "Reused the lexical type environment." },
  },
  createOnce(context) {
    return {
      Program(node) {
        const first = createLexicalTypeEnvironment(node, context.sourceCode.visitorKeys);
        const second = createLexicalTypeEnvironment(node, context.sourceCode.visitorKeys);
        if (first === second) context.report({ node, messageId: "reused" });
      },
    };
  },
});

ruleTester.run("type-environment/qualified-interfaces", qualifiedInterfacesRule, {
  valid: [
    "import type * as Domain from './owner'; declare function consume(value: Domain.Value): void;",
    "namespace Domain { export interface Value {} } function outer<Domain>() { function consume(value: Domain.Value) {} }",
    "namespace Domain { export interface Value {} } function outer() { type Domain = {}; function consume(value: Domain.Value) {} }",
    "namespace Domain { interface Value {} } namespace Domain { export function consume(value: Domain.Value) {} }",
  ],
  invalid: [
    {
      code: "namespace Domain { export interface Value {} } declare function consume(value: Domain.Value): void;",
      errors: [resolved],
    },
    {
      code: "namespace Domain { export interface Value { readonly first: string } } namespace Domain { export interface Value { readonly second: string } } declare function consume(value: Domain.Value): void;",
      errors: [resolved, resolved],
    },
    {
      code: "namespace Domain { export namespace Types { export interface Value {} } } declare function consume(value: Domain.Types.Value): void;",
      errors: [resolved],
    },
    {
      code: "declare function consume(value: Domain.Value): void; namespace Domain { export interface Value {} }",
      errors: [resolved],
    },
  ],
});

ruleTester.run("type-environment/cache", cachedEnvironmentRule, {
  valid: [],
  invalid: [
    {
      code: "type Value = string;",
      errors: [{ messageId: "reused" }],
    },
  ],
});
