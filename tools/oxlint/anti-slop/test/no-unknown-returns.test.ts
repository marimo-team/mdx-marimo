import { noUnknownReturnsRule } from "../rules/no-unknown-returns.ts";
import { testRule } from "./rule-tester.ts";

testRule("no-unknown-returns", noUnknownReturnsRule, {
  valid: [
    `
      type Promise<T> = { value: T };
      declare function read(): Promise<unknown>;
    `,
    `
      type PromiseLike<T> = { value: T };
      declare function read(): PromiseLike<unknown>;
    `,
    `
      type Result = unknown;
      function owner() {
        type Result = string;
        function read(): Result { return "ok"; }
        return read;
      }
    `,
    `
      type Result = unknown;
      namespace Values {
        type Result = string;
        export function read(): Result { return "ok"; }
      }
    `,
    "type Identity<Value> = Value; declare function read<Value>(): Identity<Value>;",
  ],
  invalid: [
    {
      code: "declare function read(): Promise<unknown>;",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "const Promise = 1; declare function read(): Promise<unknown>;",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "function owner() { type Result = unknown; function read(): Result { throw new Error(); } }",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "type Result = unknown; function owner() { const Result = 1; function read(): Result { throw new Error(); } return Result; }",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "namespace Values { type Result = unknown; export function read(): Result { throw new Error(); } }",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "type Identity<Value> = Value; declare function read(): Identity<unknown>;",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "type Identity<Value = unknown> = Value; declare function read(): Identity;",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "type Identity<Value> = Value; type Wrapped<Value> = Identity<Value>; declare function read(): Wrapped<unknown>;",
      errors: [{ messageId: "unknownReturn" }],
    },
  ],
});
