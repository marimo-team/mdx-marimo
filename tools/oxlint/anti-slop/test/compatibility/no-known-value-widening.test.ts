import { noKnownValueWideningRule } from "../../rules/no-known-value-widening.ts";
import { testRule } from "../rule-tester.ts";

testRule("no-known-value-widening", noKnownValueWideningRule, {
  valid: [
    "const values: { [Key in string]: unknown } = {};",
    'const values: { [Key in string | "first"]: unknown } = {};',
    'const values: { [Key in PropertyKey | "first"]: unknown } = {};',
    "const values: { [Key in keyof any]: unknown } = {};",
    'const values: Record<string | "first", unknown> = {};',
    "type Box<Value> = { readonly value: Value }; const value: Box<object> = { value: {} };",
    "interface Base { readonly [key: string]: number } interface Values extends Base { readonly id: number } const values: Values = { id: 1 };",
    "type Base = { readonly [key: string]: number; readonly id: number }; interface Values extends Base {} const values: Values = { id: 1 };",
    "type Base<Key extends PropertyKey> = Record<Key, number>; interface Values extends Base<'id'> {} const values: Values = { id: 1 };",
    "type Base<Key extends PropertyKey> = Record<Key, number>; interface Values<Key extends PropertyKey> extends Base<Key> {} const values: Values<'id'> = { id: 1 };",
    "type Record<Key, Value> = { readonly key: Key; readonly value: Value }; type Base = Record<string, number>; interface Values extends Base {} const values: Values = { key: 'id', value: 1 };",
    "import type { Base } from './owner'; interface Values extends Base {} const values: Values = { item: 1 };",
    "type First = Second; type Second = First; interface Values extends First {} const values: Values = {};",
    "class Base { readonly [key: string]: number; readonly id = 1 } interface Values extends Base {} const values: Values = { id: 1 };",
    "class Base { readonly [key: string]: number; constructor(readonly id: number) {} } interface Values extends Base {} const values: Values = { id: 1 };",
    "class Root { readonly [key: string]: number; readonly id = 1 } class Base extends Root {} interface Values extends Base {} const values: Values = { id: 1 };",
    "namespace Types { export type Values = Record<string, string>; } const values: Types.Values = {};",
    'export {}; namespace globalThis { export type Record<Key, Value> = { key: Key; value: Value }; } const values: globalThis.Record<string, string> = { key: "name", value: "Ada" };',
  ],
  invalid: [
    {
      code: 'const values: { [Key in "first" | "second"]: unknown } = {};',
      errors: [{ messageId: "widening" }],
    },
    {
      code: 'const Record = 1; const values: Record<string, unknown> = { name: "Ada" };',
      errors: [{ messageId: "widening" }],
    },
    {
      code: 'type Values = { [Key in "first" | "second"]: unknown }; const values: Values = {};',
      errors: [{ messageId: "widening" }],
    },
    {
      code: 'type Values<Key extends string> = { [Name in Key]: unknown }; const values: Values<"first"> = {};',
      errors: [{ messageId: "widening" }],
    },
    {
      code: 'const values: Record<"first" | "second", unknown> = {};',
      errors: [{ messageId: "widening" }],
    },
    {
      code: 'type Values = Record<"first" | "second", unknown>; const values: Values = {};',
      errors: [{ messageId: "widening" }],
    },
    {
      code: 'namespace Types { export type Values = Record<string, string>; } const values: Types.Values = { name: "Ada" };',
      errors: [{ messageId: "widening" }],
    },
    {
      code: 'const values: globalThis.Record<string, string> = { name: "Ada" };',
      errors: [{ messageId: "widening" }],
    },
    {
      code: "type Box<Value> = Value; const value: Box<object> = { id: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "type Box<Value> = Value; const value: Box<unknown> = { id: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "interface Base { [key: string]: number } interface Values extends Base {} const values: Values = { item: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "namespace Domain { export interface Base { [key: string]: number } } interface Values extends Domain.Base {} const values: Values = { item: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "type Base = { [key: string]: number }; interface Values extends Base {} const values: Values = { item: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "namespace Domain { export type Base = { [key: string]: number } } interface Values extends Domain.Base {} const values: Values = { item: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "type Base<Key extends PropertyKey> = Record<Key, number>; interface Values extends Base<string> {} const values: Values = { item: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "type Base<Key extends PropertyKey> = Record<Key, number>; interface Values<Key extends PropertyKey> extends Base<Key> {} const values: Values<string> = { item: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "class Base { readonly [key: string]: number } interface Values extends Base {} const values: Values = { item: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "namespace Domain { export class Base { readonly [key: string]: number } } interface Values extends Domain.Base {} const values: Values = { item: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "class Root { readonly [key: string]: number } class Base extends Root {} interface Values extends Base {} const values: Values = { item: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "class Base { readonly [key: string]: number; static readonly id = 1 } interface Values extends Base {} const values: Values = { item: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "class Base { readonly [key: string]: number; constructor(id: number) {} } interface Values extends Base {} const values: Values = { item: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "class Base { readonly [key: string]: number; readonly id?: number } interface Values extends Base {} const values: Values = { item: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "class Base { readonly [key: string]: number; constructor(readonly id?: number) {} } interface Values extends Base {} const values: Values = { item: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "interface Base { [key: string]: number } interface Values extends Base {} const fields: { [Key in keyof Values]: number } = { item: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "type Base = { [key: string]: number }; interface Values extends Base {} const fields: { [Key in keyof Values]: number } = { item: 1 };",
      errors: [{ messageId: "widening" }],
    },
    {
      code: "class Base { readonly [key: string]: number } interface Values extends Base {} const fields: { [Key in keyof Values]: number } = { item: 1 };",
      errors: [{ messageId: "widening" }],
    },
  ],
});
