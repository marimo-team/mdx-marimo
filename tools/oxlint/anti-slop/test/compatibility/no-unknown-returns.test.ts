import { noUnknownReturnsRule } from "../../rules/no-unknown-returns.ts";
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
    "namespace Contracts { export type Payload = string; } declare function read(): Contracts.Payload;",
    "namespace Contracts { export const Payload = 1; export type Payload = string; } declare function read(): Contracts.Payload;",
    "namespace Contracts { export type Identity<Value> = Value; } declare function read(): Contracts.Identity<string>;",
    "namespace Contracts { export type Promise<Value> = { value: Value }; } declare function read(): Contracts.Promise<unknown>;",
    "export {}; namespace globalThis { export type Promise<Value> = { value: Value }; export type PromiseLike<Value> = { value: Value }; } declare function read(): globalThis.Promise<unknown>; declare function readLike(): globalThis.PromiseLike<unknown>;",
    "namespace Outer { export namespace Inner { export type Payload = string; } } declare function read(): Outer.Inner.Payload;",
    "namespace Contracts { export type Payload = string; } import C = Contracts; declare function read(): C.Payload;",
    "namespace Contracts { export type Payload = string; } import Payload = Contracts.Payload; declare function read(): Payload;",
  ],
  invalid: [
    {
      code: "declare function read(): Promise<unknown>;",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "declare function read(): globalThis.Promise<unknown>;",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "declare function read(): globalThis.PromiseLike<unknown>;",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "export {}; const globalThis = 1; declare function read(): globalThis.Promise<unknown>;",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "const Promise = 1; declare function read(): Promise<unknown>;",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "function owner(Promise: number) { function read(): Promise<unknown> { throw new Error(); } return Promise; }",
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
      code: "namespace Contracts { export type Payload = unknown; } declare function read(): Contracts.Payload;",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "namespace Contracts { export type Payload = unknown; } function owner() { const Contracts = 1; function read(): Contracts.Payload { throw new Error(); } return Contracts; }",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "namespace Contracts { export const Payload = 1; export type Payload = unknown; } declare function read(): Contracts.Payload;",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "namespace Contracts { export type Identity<Value> = Value; } declare function read(): Contracts.Identity<unknown>;",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "namespace Outer { export namespace Inner { export type Payload = unknown; } } declare function read(): Outer.Inner.Payload;",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "namespace Contracts { export type Payload = unknown; } import C = Contracts; declare function read(): C.Payload;",
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: "namespace Contracts { export type Payload = unknown; } import Payload = Contracts.Payload; declare function read(): Payload;",
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
