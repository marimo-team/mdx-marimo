import { noKnownValueWideningRule } from "../rules/no-known-value-widening.ts";
import { ruleTester } from "./rule-tester.ts";

const error = { messageId: "widening" };

ruleTester.run("anti-slop/no-known-value-widening", noKnownValueWideningRule, {
  valid: [
    "type Promise<T> = { readonly value: T }; function create(): Promise<object> { return { value: {} }; }",
    "import type { Promise } from './promise'; function create(): Promise<object> { return { value: {} }; }",
    "type Promise<T> = { readonly value: T }; type Result = Promise<object>; async function create(): Result { return {}; }",
    "import type { Promise } from './promise'; type Result = Promise<object>; async function create(): Result { return {}; }",
    "type Result = Next; type Next = Result; async function create(): Result { return {}; }",
    "type Result<T> = Result<T>; async function create(): Result<object> { return {}; }",
    "const fields: { [K in 'a' | 'b']: number } = { a: 1, b: 2 };",
    "const fields: Record<'a' | 'b', number> = { a: 1, b: 2 };",
    "type Fields<Key extends PropertyKey> = { [K in Key]: number }; const fields: Fields<'a' | 'b'> = { a: 1, b: 2 };",
    "type Owner = { a: number; b: number }; const fields: { [K in keyof Owner]: number } = { a: 1, b: 2 };",
    "type Field = 'id' | 'name'; const fields: { [K in `item-${Field}`]: number } = { 'item-id': 1, 'item-name': 2 };",
    "const fields: { [K in `${boolean}`]: number } = { true: 1, false: 0 };",
    "type Value = 1n | 2n; const fields: { [K in `${Value}`]: number } = { '1': 1, '2': 2 };",
    "const fields: { [K in Uppercase<'a' | 'b'>]: number } = { A: 1, B: 2 };",
    "type Uppercase<Value> = 'fixed'; const fields: { [K in Uppercase<string>]: number } = { fixed: 1 };",
    "import type { Lowercase } from './owner'; const fields: { [K in Lowercase<string>]: number } = { fixed: 1 };",
    "type Record<Key, Value> = { readonly a: Value }; type Key = keyof Record<string, number>; const fields: { [K in Key]: number } = { a: 1 };",
    "import type { Record } from './owner'; type Key = keyof Record<string, number>; const fields: { [K in Key]: number } = { a: 1 };",
    "interface Values { readonly id: number } const values: Values = { id: 1 };",
    "import type { Values } from './owner'; const values: Values = { id: 1 };",
    "interface Values { [key: string]: number } function create() { interface Values { readonly id: number } const values: Values = { id: 1 }; }",
    "interface Owner { readonly id: number } const value: Awaited<Owner> = { id: 1 };",
    "interface Owner { readonly id: number } const value: Awaited<Promise<Owner>> = { id: 1 };",
    "type Awaited<Value> = { readonly value: Value }; const value: Awaited<unknown> = { value: {} };",
    "import type { Awaited } from './owner'; const value: Awaited<unknown> = { id: 1 };",
    "namespace Domain { export interface Values { readonly id: number } } const values: Domain.Values = { id: 1 };",
    "import type * as Domain from './owner'; const values: Domain.Values = { item: 1 };",
    "namespace Domain { export interface Values { [key: string]: number } } function create<Domain>() { const values: Domain.Values = { item: 1 }; }",
    "interface Result { readonly [key: string]: number; readonly id: number } const result: Result = { id: 1 };",
    "interface Result { readonly [key: string]: number } interface Result { readonly id: number } const result: Result = { id: 1 };",
    "type Result = { readonly [key: string]: number; readonly id: number }; const result: Result = { id: 1 };",
    "const fields: { [K in string & 'id']: number } = { id: 1 };",
    "declare const condition: boolean; declare const external: unknown; const widened: unknown = condition ? { id: 1 } : external;",
    "declare function touch(): void; declare function load(): unknown; const widened: unknown = (touch(), load());",
    {
      code: "const value: JSX.Element = <div />;",
      languageOptions: { parserOptions: { lang: "tsx" } },
    },
    "const { value } = { value: { id: 1 } };",
    "interface Values { readonly value: { readonly id: number } } const { value }: Values = { value: { id: 1 } };",
    "const [value] = [{ id: 1 }];",
    "type Values = readonly [{ readonly id: number }]; const [value]: Values = [{ id: 1 }];",
    "interface Options { readonly id: number } function create(value: Options = { id: 1 }) {}",
    "declare function load(): { readonly id: number }; function create(value: { readonly id: number } = load()) {}",
  ],
  invalid: [
    {
      code: "async function create(): Promise<object> { return {}; }",
      errors: [error],
    },
    {
      code: "const create = async (): Promise<object> => ({});",
      errors: [error],
    },
    {
      code: "type Result = Promise<object>; async function create(): Result { return {}; }",
      errors: [error],
    },
    {
      code: "type Result<Value> = Promise<Value>; const create = async (): Result<object> => ({});",
      errors: [error],
    },
    {
      code: "const value: object = {} as object;",
      errors: 1,
    },
    {
      code: "function create() { type Values = Record<string, unknown>; const values: Values = { item: 1 }; }",
      errors: [error],
    },
    {
      code: "const fields: { [K in string]: number } = { item: 1 };",
      errors: [error],
    },
    {
      code: "const fields: Record<string, number> = { item: 1 };",
      errors: [error],
    },
    {
      code: "const fields: Record<number, number> = { 1: 1 };",
      errors: [error],
    },
    {
      code: "const fields: Record<symbol, number> = { [Symbol.iterator]: 1 };",
      errors: [error],
    },
    {
      code: "const fields: Record<PropertyKey, number> = { item: 1 };",
      errors: [error],
    },
    {
      code: "type Fields<Key extends PropertyKey> = { [K in Key]: number }; const fields: Fields<string> = { item: 1 };",
      errors: [
        {
          messageId: "widening",
          data: { subject: "binding `fields`", target: "generic container" },
        },
      ],
    },
    {
      code: "const fields: { [Key in keyof any]: number } = { item: 1 };",
      errors: [error],
    },
    {
      code: "type Key = keyof any; const fields: { [Property in Key]: number } = { item: 1 };",
      errors: [error],
    },
    {
      code: "const fields: { [Key in `${string}`]: number } = { item: 1 };",
      errors: [error],
    },
    {
      code: "const fields: { [Key in `${number}`]: number } = { 1: 1 };",
      errors: [error],
    },
    {
      code: "const fields: { [Key in `${bigint}`]: number } = { 1: 1 };",
      errors: [error],
    },
    {
      code: "const fields: { [Key in Uppercase<string>]: number } = { ITEM: 1 };",
      errors: [error],
    },
    {
      code: "const fields: { [Key in Lowercase<string>]: number } = { item: 1 };",
      errors: [error],
    },
    {
      code: "const fields: { [Key in Capitalize<string>]: number } = { Item: 1 };",
      errors: [error],
    },
    {
      code: "const fields: { [Key in Uncapitalize<string>]: number } = { item: 1 };",
      errors: [error],
    },
    {
      code: "type Key = keyof Record<string, number>; const fields: { [Property in Key]: number } = { item: 1 };",
      errors: [error],
    },
    {
      code: "type Open = Record<string, number>; type Key = keyof Open; const fields: { [Property in Key]: number } = { item: 1 };",
      errors: [error],
    },
    {
      code: "type Key = keyof { [name: string]: number }; const fields: { [Property in Key]: number } = { item: 1 };",
      errors: [error],
    },
    {
      code: "interface Values { [key: string]: number } const values: Values = { item: 1 };",
      errors: [error],
    },
    {
      code: "interface Values {} interface Values { [key: string]: number } const values: Values = { item: 1 };",
      errors: [error],
    },
    {
      code: "const value: Awaited<unknown> = { id: 1 };",
      errors: [error],
    },
    {
      code: "const value: Awaited<object> = { id: 1 };",
      errors: [error],
    },
    {
      code: "const value: Awaited<Promise<object>> = { id: 1 };",
      errors: [error],
    },
    {
      code: "namespace Domain { export interface Values { [key: string]: number } } const values: Domain.Values = { item: 1 };",
      errors: [error],
    },
    {
      code: "namespace Domain { export interface Values {} } namespace Domain { export interface Values { [key: string]: number } } const values: Domain.Values = { item: 1 };",
      errors: [error],
    },
    {
      code: "interface Values { [key: string]: number; readonly id?: number } const values: Values = { item: 1 };",
      errors: [error],
    },
    {
      code: "type Values = { [key: string]: number; readonly id?: number }; const values: Values = { item: 1 };",
      errors: [error],
    },
    {
      code: "const value: { [key: string]: number; readonly id: number } = { id: 1 };",
      errors: [error],
    },
    {
      code: "const fields: { [Key in string & {}]: number } = { item: 1 };",
      errors: [error],
    },
    {
      code: "type Key = string & {}; const fields: { [Property in Key]: number } = { item: 1 };",
      errors: [error],
    },
    {
      code: "declare const condition: boolean; const widened: unknown = condition ? { id: 1 } : { id: 2 };",
      errors: [error],
    },
    {
      code: "declare function touch(): void; const widened: unknown = (touch(), { id: 1 });",
      errors: [error],
    },
    {
      code: "const value: object = <div />;",
      languageOptions: { parserOptions: { lang: "tsx" } },
      errors: [error],
    },
    {
      code: "const value: object = <>content</>;",
      languageOptions: { parserOptions: { lang: "tsx" } },
      errors: [error],
    },
    {
      code: "const { value }: { value: unknown } = { value: { id: 1 } };",
      errors: [error],
    },
    {
      code: "const [value]: object = [{ id: 1 }];",
      errors: [error],
    },
    {
      code: "declare const condition: boolean; const value: object = condition ? ({} as object) : ({} as object);",
      errors: 1,
    },
    {
      code: "declare function touch(): void; const value: object = (touch(), {} as object);",
      errors: 1,
    },
    {
      code: "declare const condition: boolean; declare const external: unknown; const value: unknown = condition ? ({} as object) : external;",
      errors: 1,
    },
    {
      code: "declare function load(): unknown; const value: unknown = ({} as object, load());",
      errors: 1,
    },
    {
      code: "function create(value: { readonly id: number } = { id: 1 }) {}",
      errors: [error],
    },
  ],
});
