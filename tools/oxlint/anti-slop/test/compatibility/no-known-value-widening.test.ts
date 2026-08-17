import { noKnownValueWideningRule } from "../../rules/no-known-value-widening.ts";
import { testRule } from "./rule-tester.ts";

testRule("no-known-value-widening", noKnownValueWideningRule, {
  valid: [
    "const values: { [Key in string]: unknown } = {};",
    'const values: { [Key in string | "first"]: unknown } = {};',
    'const values: { [Key in PropertyKey | "first"]: unknown } = {};',
    "const values: { [Key in keyof any]: unknown } = {};",
    'const values: Record<string | "first", unknown> = {};',
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
  ],
});
