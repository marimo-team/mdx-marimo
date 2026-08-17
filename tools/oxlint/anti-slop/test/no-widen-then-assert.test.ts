import { noWidenThenAssertRule } from "../rules/no-widen-then-assert.ts";
import { ruleTester } from "./rule-tester.ts";

const error = { messageId: "widenThenAssert" };

ruleTester.run("anti-slop/no-widen-then-assert", noWidenThenAssertRule, {
  valid: [
    "type Record<Key, Value> = { readonly key: Key; readonly value: Value }; const widened: Record<string, unknown> = { key: 'id', value: 1 }; const parsed = widened as { readonly key: string; readonly value: number };",
    "import type { Record } from './owner'; const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as { readonly id: number };",
    "type Readonly<Value> = { readonly value: Value }; const widened: Readonly<Record<string, unknown>> = { value: { id: 1 } }; const parsed = widened as { readonly value: { readonly id: number } };",
    "type PropertyKey = 'id'; const widened: Record<PropertyKey, unknown> = { id: 1 }; const parsed = widened as { readonly id: number };",
    "const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as { [key: string]: unknown };",
    "interface Result { readonly [key: string]: unknown } const widened: Record<string, unknown> = { id: 1 }; const parsed = widened as Result;",
    "interface Result { readonly [key: string]: number } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
    "type Left = Right; type Right = Left; const widened: Record<string, number> = { id: 1 }; const parsed = widened as Left;",
    "interface Result { readonly id: number } function run() { interface Result { readonly [key: string]: number } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result; }",
    "declare const condition: boolean; declare const external: unknown; const widened: unknown = condition ? { id: 1 } : external; const parsed = widened as { readonly id: number };",
    "declare function touch(): void; declare function load(): unknown; const widened: unknown = (touch(), load()); const parsed = widened as { readonly id: number };",
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
  ],
});
