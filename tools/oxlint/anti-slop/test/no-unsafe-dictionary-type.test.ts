import { noUnsafeDictionaryTypeRule } from "../rules/no-unsafe-dictionary-type.ts";
import { testRule } from "./rule-tester.ts";

testRule("no-unsafe-dictionary-type", noUnsafeDictionaryTypeRule, {
  valid: [
    `
      type Values = { outer: string };
      function owner() {
        type Values = { value: string };
        const result: Values = { value: "ok" };
        return result;
      }
    `,
    'type Values<K = unknown> = { [K in "key"]: K }; const value: Values = { key: "key" };',
    "interface Value {} interface Value { name: string } type Values = Record<string, Value>;",
    "class Value { name!: string } interface Value {} type Values = Record<string, Value>;",
  ],
  invalid: [
    {
      code: "type Values<Value = unknown> = Record<string, Value>; const result: Values = {};",
      errors: [{ messageId: "unsafeDictionary" }],
    },
    {
      code: "const Record = 1; type Values = Record<string, unknown>;",
      errors: [{ messageId: "unsafeDictionary" }],
    },
    {
      code: "type Values = { outer: string }; function owner() { type Values = Record<string, unknown>; const result: Values = {}; return result; }",
      errors: [{ messageId: "unsafeDictionary" }],
    },
    {
      code: "interface Empty {} interface Empty {} type Values = Record<string, Empty>;",
      errors: [{ messageId: "unsafeDictionary" }],
    },
    {
      code: "interface Empty { first?: never } interface Empty { second?: never } type Values = Record<string, Empty>;",
      errors: [{ messageId: "unsafeDictionary" }],
    },
  ],
});
