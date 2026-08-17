import { noWidenThenAssertRule } from "../rules/no-widen-then-assert.ts";
import { ruleTester } from "./rule-tester.ts";

const error = { messageId: "widenThenAssert" };
const manyWideningFlows = Array.from(
  { length: 32 },
  (_, index) =>
    `const widened_${index}: unknown = { id: ${index} }; widened_${index} as { readonly id: number };`,
).join("\n");

ruleTester.run("anti-slop/no-widen-then-assert", noWidenThenAssertRule, {
  valid: [
    "type Record<Key, Value> = { readonly key: Key; readonly value: Value }; const widened: Record<string, unknown> = { key: 'id', value: 1 }; const parsed = widened as { readonly key: string; readonly value: number };",
    "import type { Record } from './owner'; const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as { readonly id: number };",
    "type Readonly<Value> = { readonly value: Value }; const widened: Readonly<Record<string, unknown>> = { value: { id: 1 } }; const parsed = widened as { readonly value: { readonly id: number } };",
    "type PropertyKey = 'id'; const widened: Record<PropertyKey, unknown> = { id: 1 }; const parsed = widened as { readonly id: number };",
    "const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as { [key: string]: unknown };",
    "interface Result { readonly [key: string]: unknown } const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as Result;",
    "interface Base { readonly [key: string]: unknown } interface Result extends Base {} const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as Result;",
    "namespace Domain { export interface Base { readonly [key: string]: unknown } export interface Result extends Base {} } const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as Domain.Result;",
    "type Base = { readonly [key: string]: unknown }; interface Result extends Base {} const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as Result;",
    "namespace Domain { export type Base = { readonly [key: string]: unknown }; export interface Result extends Base {} } const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as Domain.Result;",
    "type Base<Value> = { readonly [key: string]: Value }; interface Result extends Base<unknown> {} const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as Result;",
    "interface Result { readonly [key: string]: number } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
    "type Left = Right; type Right = Left; const widened: Record<string, number> = { id: 1 }; const parsed = widened as Left;",
    "interface Result { readonly id: number } function run() { interface Result { readonly [key: string]: number } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result; }",
    "declare const condition: boolean; declare const external: unknown; const widened: unknown = condition ? { id: 1 } : external; const parsed = widened as { readonly id: number };",
    "declare function touch(): void; declare function load(): unknown; const widened: unknown = (touch(), load()); const parsed = widened as { readonly id: number };",
    "type Broad = unknown; const widened: unknown = { id: 1 }; const parsed = widened as Broad;",
    "type Broad = object; const widened: object = { id: 1 }; const parsed = widened as Broad;",
    "type Broad = Record<string, unknown>; const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as Broad;",
    "namespace Domain { export interface Result { readonly [key: string]: number } } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Domain.Result;",
    "interface Base { readonly [key: string]: number } interface Result extends Base {} const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
    "type Base = { readonly [key: string]: number }; interface Result extends Base {} const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
    "namespace Domain { export type Base = { readonly [key: string]: number }; export interface Result extends Base {} } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Domain.Result;",
    "class Base { readonly [key: string]: number } interface Result extends Base {} const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
    "namespace Domain { export class Base { readonly [key: string]: number } export interface Result extends Base {} } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Domain.Result;",
    "class Base { static readonly id = 1; constructor() {} } interface Result extends Base { readonly [key: string]: number } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
    "class Base { constructor(id: number) {} } interface Result extends Base { readonly [key: string]: number } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
    "class Owner { constructor(id: number) {} } class Base extends Owner {} interface Result extends Base { readonly [key: string]: number } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
    "namespace Domain { export class Base { static readonly id = 1; constructor(value: number) {} } export interface Result extends Base { readonly [key: string]: number } } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Domain.Result;",
    "type Record<Key, Value> = { readonly key: Key; readonly value: Value }; type Bag<Value> = Record<string, Value>; const widened: Bag<unknown> = { key: 'id', value: 1 }; const parsed = widened as { readonly key: string; readonly value: number };",
    "interface Left extends Right {} interface Right extends Left {} const widened: Record<string, number> = { id: 1 }; const parsed = widened as Left;",
    "interface Result {} const widened: object = { id: 1 }; const parsed = widened as Result;",
    "namespace Domain { export interface Result {} } const widened: object = { id: 1 }; const parsed = widened as Domain.Result;",
    "interface Left extends Right {} interface Right extends Left {} const widened: object = { id: 1 }; const parsed = widened as Left;",
    "type Left = Right; type Right = Left; interface Result extends Left {} const widened: object = { id: 1 }; const parsed = widened as Result;",
    "class Base {} interface Result extends Base {} const widened: object = { id: 1 }; const parsed = widened as Result;",
    "namespace Domain { export class Base {} export interface Result extends Base {} } const widened: object = { id: 1 }; const parsed = widened as Domain.Result;",
  ],
  invalid: [
    {
      code: "const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as { [key: string]: number };",
      errors: [error],
    },
    {
      code: "interface Result { readonly [key: string]: number; readonly id: number } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
      errors: [error],
    },
    {
      code: "type Result = { readonly [key: string]: number; readonly id: number }; const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
      errors: [error],
    },
    {
      code: "declare const condition: boolean; const widened: unknown = condition ? { id: 1 } : { id: 2 }; const parsed = widened as { readonly id: number };",
      errors: [error],
    },
    {
      code: "declare function touch(): void; const widened: unknown = (touch(), { id: 1 }); const parsed = widened as { readonly id: number };",
      errors: [error],
    },
    {
      code: "namespace Domain { export interface Result { readonly id: number } } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Domain.Result;",
      errors: [error],
    },
    {
      code: "interface Base { readonly id: number } interface Result extends Base { readonly [key: string]: number } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
      errors: [error],
    },
    {
      code: "namespace Domain { export interface Base { readonly id: number } export interface Result extends Base { readonly [key: string]: number } } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Domain.Result;",
      errors: [error],
    },
    {
      code: "interface Base { readonly id: number } interface Result extends Base {} const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as Result;",
      errors: [error],
    },
    {
      code: "namespace Domain { export interface Base { readonly id: number } export interface Result extends Base {} } const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as Domain.Result;",
      errors: [error],
    },
    {
      code: "type Base = { readonly id: number }; interface Result extends Base {} const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as Result;",
      errors: [error],
    },
    {
      code: "namespace Domain { export type Base = { readonly id: number }; export interface Result extends Base {} } const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as Domain.Result;",
      errors: [error],
    },
    {
      code: "type Base<Value> = { readonly id: Value }; interface Result extends Base<number> {} const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as Result;",
      errors: [error],
    },
    {
      code: "type Base<Value> = { readonly [key: string]: Value }; interface Result extends Base<number> {} const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as Result;",
      errors: [error],
    },
    {
      code: "namespace Domain { export type Base<Value> = { readonly [key: string]: Value }; export interface Result extends Base<number> {} } const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as Domain.Result;",
      errors: [error],
    },
    {
      code: "type Base<Value> = { readonly [key: string]: Value }; interface Bag extends Base<unknown> {} const widened: Bag = { id: 1 }; const parsed = widened as { readonly id: number };",
      errors: [error],
    },
    {
      code: "namespace Domain { export type Base = { readonly [key: string]: unknown }; export interface Bag extends Base {} } const widened: Domain.Bag = { id: 1 }; const parsed = widened as { readonly id: number };",
      errors: [error],
    },
    {
      code: "type Base = { readonly [key: string]: number }; interface Bag extends Base {} const widened: Bag = { id: 1 }; const parsed = widened as { readonly id: number };",
      errors: [error],
    },
    {
      code: "type Base = { readonly id: number }; interface Result extends Base { readonly [key: string]: number } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
      errors: [error],
    },
    {
      code: "namespace Domain { export type Base = { readonly id: number }; export interface Result extends Base { readonly [key: string]: number } } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Domain.Result;",
      errors: [error],
    },
    {
      code: "interface Result { readonly id: number } const widened: object = { id: 1 }; const parsed = widened as Result;",
      errors: [error],
    },
    {
      code: "namespace Domain { export interface Result { readonly id: number } } const widened: object = { id: 1 }; const parsed = widened as Domain.Result;",
      errors: [error],
    },
    {
      code: "type Result = { readonly id: number }; const widened: object = { id: 1 }; const parsed = widened as Result;",
      errors: [error],
    },
    {
      code: "namespace Domain { export type Result = { readonly id: number } } const widened: object = { id: 1 }; const parsed = widened as Domain.Result;",
      errors: [error],
    },
    {
      code: "type Base = { readonly id: number }; interface Result extends Base {} const widened: object = { id: 1 }; const parsed = widened as Result;",
      errors: [error],
    },
    {
      code: "namespace Domain { export type Base = { readonly id: number }; export interface Result extends Base {} } const widened: object = { id: 1 }; const parsed = widened as Domain.Result;",
      errors: [error],
    },
    {
      code: "class Base { readonly id = 1 } interface Result extends Base { readonly [key: string]: number } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
      errors: [error],
    },
    {
      code: "namespace Domain { export class Base { readonly id = 1 } export interface Result extends Base { readonly [key: string]: number } } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Domain.Result;",
      errors: [error],
    },
    {
      code: "class Base { constructor(readonly id: number) {} } interface Result extends Base { readonly [key: string]: number } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
      errors: [error],
    },
    {
      code: "namespace Domain { export class Base { constructor(readonly id: number) {} } export interface Result extends Base { readonly [key: string]: number } } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Domain.Result;",
      errors: [error],
    },
    {
      code: "class Owner { constructor(readonly id: number) {} } class Base extends Owner {} interface Result extends Base { readonly [key: string]: number } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
      errors: [error],
    },
    {
      code: "namespace Domain { export class Owner { constructor(readonly id: number) {} } export class Base extends Owner {} export interface Result extends Base { readonly [key: string]: number } } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Domain.Result;",
      errors: [error],
    },
    {
      code: "class Base { readonly [key: string]: number; constructor(readonly id: number) {} } interface Result extends Base {} const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
      errors: [error],
    },
    {
      code: "type Broad = unknown; const widened: Broad = { id: 1 }; const parsed = widened as { readonly id: number };",
      errors: [error],
    },
    {
      code: "type Broad = object; const widened: Broad = { id: 1 }; const parsed = widened as { readonly id: number };",
      errors: [error],
    },
    {
      code: "type Bag<Value> = Record<string, Value>; const widened: Bag<unknown> = { id: 1 }; const parsed = widened as { readonly id: number };",
      errors: [error],
    },
    {
      code: "interface Bag { readonly [key: string]: unknown } const widened: Bag = { id: 1 }; const parsed = widened as { readonly id: number };",
      errors: [error],
    },
    {
      code: "interface Bag<Value> { readonly [key: string]: Value } const widened: Bag<unknown> = { id: 1 }; const parsed = widened as { readonly id: number };",
      errors: [error],
    },
    {
      code: "namespace Domain { export interface Bag { readonly [key: string]: unknown } } const widened: Domain.Bag = { id: 1 }; const parsed = widened as { readonly id: number };",
      errors: [error],
    },
    {
      code: "interface Bag { readonly [key: string]: unknown } const widened: Bag = { id: 1 }; const parsed = widened as { readonly [key: string]: number };",
      errors: [error],
    },
    {
      code: "interface Result<Value> { readonly [key: string]: Value; readonly id: Value } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result<number>;",
      errors: [error],
    },
    {
      code: manyWideningFlows,
      errors: Array.from({ length: 32 }, () => error),
    },
  ],
});
