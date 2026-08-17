import { noReflectApplyRule } from "../../rules/no-reflect-apply.ts";
import { noReflectGetRule } from "../../rules/no-reflect-get.ts";
import { testRule } from "./rule-tester.ts";

testRule("no-reflect-get", noReflectGetRule, {
  valid: [
    "const value = record.value;",
    "const value = globalThis!.Reflect.has(record, 'value');",
    `
      export {};
      const globalThis = { Reflect: { get(record: object, key: string) {} } };
      const value = globalThis!.Reflect.get(record, "value");
    `,
    `
      export {};
      const Reflect = { get(record: object, key: string) {} };
      const value = Reflect!.get(record, "value");
    `,
  ],
  invalid: [
    {
      code: "const value = Reflect.get(record, 'value');",
      errors: [{ messageId: "reflectGet" }],
    },
    {
      code: "const value = (Reflect?.get)(record, 'value');",
      errors: [{ messageId: "reflectGet" }],
    },
    {
      code: "const value = Reflect[`get`](record, 'value');",
      errors: [{ messageId: "reflectGet" }],
    },
    {
      code: "const value = Reflect['get' as const](record, 'value');",
      errors: [{ messageId: "reflectGet" }],
    },
    {
      code: "const value = Reflect[<string>'get'](record, 'value');",
      errors: [{ messageId: "reflectGet" }],
    },
    {
      code: "interface Reflect {}; const value = Reflect.get(record, 'value');",
      errors: [{ messageId: "reflectGet" }],
    },
    {
      code: "const value = globalThis.Reflect.get(record, 'value');",
      errors: [{ messageId: "reflectGet" }],
    },
    {
      code: "const value = Reflect!.get(record, 'value');",
      errors: [{ messageId: "reflectGet" }],
    },
    {
      code: "const value = globalThis!.Reflect.get(record, 'value');",
      errors: [{ messageId: "reflectGet" }],
    },
    {
      code: "const value = (globalThis as typeof globalThis).Reflect.get(record, 'value');",
      errors: [{ messageId: "reflectGet" }],
    },
    {
      code: "const value = (<typeof Reflect>Reflect).get(record, 'value');",
      errors: [{ messageId: "reflectGet" }],
    },
    {
      code: "const value = (Reflect satisfies typeof Reflect).get(record, 'value');",
      errors: [{ messageId: "reflectGet" }],
    },
  ],
});

testRule("no-reflect-apply", noReflectApplyRule, {
  valid: ["const value = callback(...args);"],
  invalid: [
    {
      code: "const value = Reflect[`apply`](callback, receiver, args);",
      errors: [{ messageId: "reflectApply" }],
    },
    {
      code: "const value = Reflect['apply' as const](callback, receiver, args);",
      errors: [{ messageId: "reflectApply" }],
    },
    {
      code: "const value = globalThis.Reflect.apply(callback, receiver, args);",
      errors: [{ messageId: "reflectApply" }],
    },
  ],
});
