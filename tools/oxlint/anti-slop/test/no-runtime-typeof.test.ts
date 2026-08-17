import { noRuntimeTypeofRule } from "../rules/no-runtime-typeof.ts";
import { ruleTester } from "./rule-tester.ts";

const error = { messageId: "runtimeTypeof" };
const allowInTypeGuards = [{ allowInTypeGuards: true }];

ruleTester.run("anti-slop/no-runtime-typeof", noRuntimeTypeofRule, {
  valid: [
    "declare const value: string; type Value = typeof value;",
    {
      code: "function isString(value: unknown): value is string { return typeof value === 'string'; }",
      options: allowInTypeGuards,
    },
    {
      code: "const isString = function(value: unknown): value is string { return typeof value === 'string'; };",
      options: allowInTypeGuards,
    },
    {
      code: "const isString = (value: unknown): value is string => typeof value === 'string';",
      options: allowInTypeGuards,
    },
    {
      code: "function parse(value: unknown) { const isString = (input: unknown): input is string => typeof input === 'string'; return isString(value); }",
      options: allowInTypeGuards,
    },
    {
      code: "function isString(value: unknown): value is string { const inspect = () => typeof value === 'string'; return inspect(); }",
      options: allowInTypeGuards,
    },
  ],
  invalid: [
    {
      code: "if (typeof value === 'string') consume(value);",
      errors: [error],
    },
    {
      code: "function isString(value: unknown): value is string { return typeof value === 'string'; }",
      errors: [error],
    },
    {
      code: "function inspect(value: unknown): boolean { return typeof value === 'string'; }",
      options: allowInTypeGuards,
      errors: [error],
    },
  ],
});
