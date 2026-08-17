import { noUnknownTypeAliasesRule } from "../rules/no-unknown-type-aliases.ts";
import { ruleTester } from "./rule-tester.ts";

const error = { messageId: "unknownAlias" };
const deeplyNestedUnknown = `${"Identity<".repeat(70)}unknown${">".repeat(70)}`;

ruleTester.run("anti-slop/no-unknown-type-aliases", noUnknownTypeAliasesRule, {
  valid: [
    "type Value = string; function outer<Value>() { type Safe = Value; }",
    "type Awaited<T> = { readonly value: T }; type Safe = Awaited<unknown>;",
    "import type * as Domain from './owner'; type Safe = Domain.Value;",
  ],
  invalid: [
    {
      code: "type Identity<T> = T; type Hidden = Identity<unknown>;",
      errors: [error],
    },
    {
      code: "type Identity<T> = T; type Hidden = Identity<Identity<unknown>>;",
      errors: [error],
    },
    {
      code: `type Identity<T> = T; type Hidden = ${deeplyNestedUnknown};`,
      errors: [error],
    },
    {
      code: "type First<A, B> = A; type Swap<X, Y> = First<Y, X>; type Hidden = Swap<string, unknown>;",
      errors: [error],
    },
    {
      code: "type Default<A, B = A> = B; type Hidden = Default<unknown>;",
      errors: [error],
    },
    {
      code: "type Alias = unknown; type Pass<Alias> = Alias; type Safe = Pass<string>;",
      errors: [error],
    },
    {
      code: "type Hidden = unknown | string;",
      errors: [error],
    },
    {
      code: "type Hidden = Awaited<unknown>;",
      errors: [error],
    },
    {
      code: "type Hidden = Awaited<Promise<unknown>>;",
      errors: [error],
    },
    {
      code: "type Hidden = Value; type Value = unknown;",
      errors: [error, error],
    },
    {
      code: "function outer() { type Hidden = unknown; }",
      errors: [error],
    },
    {
      code: "namespace Domain { export type Hidden = unknown; }",
      errors: [error],
    },
    {
      code: "namespace Domain { export type Hidden = unknown; } namespace Domain { export type Again = Hidden; }",
      errors: [error, error],
    },
    {
      code: "namespace Domain { export type Hidden = unknown; } type Again = Domain.Hidden;",
      errors: [error, error],
    },
    {
      code: "namespace Domain { export type Identity<T> = T; } type Hidden = Domain.Identity<unknown>;",
      errors: [error],
    },
    {
      code: "namespace Domain { export type Hidden = unknown; } function outer<Domain>() { type Safe = Domain.Hidden; }",
      errors: [error],
    },
    {
      code: "namespace Domain { type Hidden = unknown; } namespace Domain { export type Safe = Hidden; }",
      errors: [error],
    },
    {
      code: "declare module 'domain' { type Hidden = unknown; }",
      errors: [error],
    },
    {
      code: "type Alias = unknown; function outer() { type Alias = string; type Safe = Alias; }",
      errors: [error],
    },
    {
      code: "type Alias = string; function outer() { type Alias = unknown; type Hidden = Alias; }",
      errors: [error, error],
    },
  ],
});
