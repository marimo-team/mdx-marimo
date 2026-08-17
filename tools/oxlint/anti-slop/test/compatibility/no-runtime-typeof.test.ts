import { noRuntimeTypeofRule } from "../../rules/no-runtime-typeof.ts";
import { testRule } from "./rule-tester.ts";

testRule("no-runtime-typeof", noRuntimeTypeofRule, {
  valid: [
    {
      code: `
        function isText(value: unknown): value is string {
          return (() => typeof value === "string")();
        }
      `,
      options: [{ allowInTypeGuards: true }],
    },
  ],
  invalid: [
    {
      code: `
        function isText(value: unknown): value is string {
          return (() => typeof value === "string")();
        }
      `,
      options: [{ allowInTypeGuards: false }],
      errors: [{ messageId: "runtimeTypeof" }],
    },
    {
      code: `
        function isText(value: unknown): boolean {
          return (() => typeof value === "string")();
        }
      `,
      options: [{ allowInTypeGuards: true }],
      errors: [{ messageId: "runtimeTypeof" }],
    },
  ],
});
