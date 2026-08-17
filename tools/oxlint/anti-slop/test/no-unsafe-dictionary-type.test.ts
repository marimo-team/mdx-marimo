import { noUnsafeDictionaryTypeRule } from "../rules/no-unsafe-dictionary-type.ts";
import { ruleTester } from "./rule-tester.ts";

const error = { messageId: "unsafeDictionary" };

ruleTester.run("anti-slop/no-unsafe-dictionary-type", noUnsafeDictionaryTypeRule, {
  valid: [
    "type Value = unknown; type Dictionary<Value> = Record<string, Value>; type Safe = Dictionary<string>;",
    "type Dict<T, U> = Record<T & PropertyKey, U>; type Use<T, U> = Dict<U, T>; type Result = Use<string, unknown>;",
    "type Values = Record<string, Record<string, never>>;",
    "type Values = Record<string, { [Key in 'id']: never }>;",
    "interface Value {} interface Value { readonly id: string } type Values = Record<string, Value>;",
    "interface Owner { readonly id: string } type Values = Record<string, Pick<Owner, 'id'>>;",
    "type Pick<Owner, Key> = { readonly owner: Owner; readonly key: Key }; type Values = Record<string, Pick<{ readonly id: string }, never>>;",
    "type Awaited<Value> = { readonly value: Value }; type Values = Record<string, Awaited<unknown>>;",
    "import type { Awaited } from './owner'; type Values = Record<string, Awaited<unknown>>;",
    "type Promise<Value> = { readonly value: Value }; type Values = Record<string, Awaited<Promise<unknown>>>;",
    "namespace Domain { export interface Value { readonly id: string } } type Values = Record<string, Domain.Value>;",
    "import type * as Domain from './owner'; type Values = Record<string, Domain.Empty>;",
    "interface Base { readonly id: string } interface Empty extends Base {} type Values = Record<string, Empty>;",
    "interface Base {} interface Base { readonly id: string } interface Empty extends Base {} type Values = Record<string, Empty>;",
    "interface First {} interface Second { readonly id: string } interface Empty extends First, Second {} type Values = Record<string, Empty>;",
    "import type { Base } from './owner'; interface Empty extends Base {} type Values = Record<string, Empty>;",
    "namespace Domain { export interface Base { readonly id: string } } interface Empty extends Domain.Base {} type Values = Record<string, Empty>;",
    "interface Left extends Right {} interface Right extends Left {} type Values = Record<string, Left>;",
  ],
  invalid: [
    {
      code: "type Values = Record<'a' | 'b', unknown>;",
      errors: [error],
    },
    {
      code: "type Dict<T = unknown> = Record<string, T>; const d: Dict = {};",
      errors: 1,
    },
    {
      code: "function create() { type Hidden = unknown; type Values = Record<string, Hidden>; }",
      errors: [error],
    },
    {
      code: "type Dict<T, U> = Record<T & PropertyKey, U>; type Use<T, U> = Dict<U, T>; type Unsafe = Use<unknown, string>; const value: Unsafe = {};",
      errors: [error],
    },
    {
      code: "type Values = Record<string, Record<never, never>>;",
      errors: [error],
    },
    {
      code: "type Values = Record<string, { [Key in never]: never }>;",
      errors: [error],
    },
    {
      code: "type Empty<Key extends PropertyKey> = Record<Key, never>; type Values = Record<string, Empty<never>>;",
      errors: [error],
    },
    {
      code: "interface Value {} interface Value {} type Values = Record<string, Value>;",
      errors: [error],
    },
    {
      code: "interface Owner { readonly id: string } type Values = Record<string, Pick<Owner, never>>;",
      errors: [error],
    },
    {
      code: "interface Owner { readonly id: string } type Empty<Key extends keyof Owner = never> = Pick<Owner, Key>; type Values = Record<string, Empty>;",
      errors: [error],
    },
    {
      code: "type Values = Record<string, Awaited<unknown>>;",
      errors: [error],
    },
    {
      code: "type Values = Record<string, Awaited<Promise<unknown>>>;",
      errors: [error],
    },
    {
      code: "type Value<Result = unknown> = Awaited<Promise<Result>>; type Values = Record<string, Value>;",
      errors: [error],
    },
    {
      code: "namespace Domain { export interface Empty {} export interface Empty {} } type Values = Record<string, Domain.Empty>;",
      errors: [error],
    },
    {
      code: "interface Base {} interface Empty extends Base {} type Values = Record<string, Empty>;",
      errors: [error],
    },
    {
      code: "interface Base {} interface Base {} interface Empty extends Base {} type Values = Record<string, Empty>;",
      errors: [error],
    },
    {
      code: "namespace Domain { export interface Base {} } interface Empty extends Domain.Base {} type Values = Record<string, Empty>;",
      errors: [error],
    },
  ],
});
