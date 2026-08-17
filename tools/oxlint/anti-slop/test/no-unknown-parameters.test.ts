import { noUnknownParametersRule } from "../rules/no-unknown-parameters.ts";
import { ruleTester } from "./rule-tester.ts";

const error = { messageId: "unknownParameter" };

ruleTester.run("anti-slop/no-unknown-parameters", noUnknownParametersRule, {
  valid: [
    "function enrich(cause: unknown) {}",
    "type Input = unknown; function parse<Input>(value: Input) {}",
    "interface Input { readonly id: string } function parse(value: Input) {}",
    "type Promise<T> = { readonly value: T }; function parse(value: Promise<unknown>) {}",
    "import type { PromiseLike } from './owner'; function parse(value: PromiseLike<unknown>) {}",
    "type Awaited<T> = { readonly value: T }; function parse(value: Awaited<unknown>) {}",
    "import type { Awaited } from './owner'; function parse(value: Awaited<unknown>) {}",
    "namespace Domain { type Input = unknown; } namespace Domain { export function parse(value: Input) {} }",
    "namespace Domain { namespace Private { export type Input = unknown; } } namespace Domain { namespace Private { export function parse(value: Input) {} } }",
    "import type * as Domain from './owner'; function parse(value: Domain.Input) {}",
    "namespace Domain { export type Input = unknown; } function outer<Domain>() { function parse(value: Domain.Input) {} }",
  ],
  invalid: [
    { code: "function parse(value: (unknown)) {}", errors: [error] },
    { code: "function parse(value: string | unknown) {}", errors: [error] },
    {
      code: "type Identity<T> = T; function parse(value: Identity<unknown>) {}",
      errors: [error],
    },
    {
      code: "type Identity<T> = T; function parse(value: Identity<Identity<unknown>>) {}",
      errors: [error],
    },
    {
      code: "type Promise<T> = T; function parse(value: Promise<unknown>) {}",
      errors: [error],
    },
    {
      code: "function outer() { type Input = unknown; function parse(value: Input) {} }",
      errors: [error],
    },
    {
      code: "function outer() { function parse(value: Input) {} type Input = unknown; }",
      errors: [error],
    },
    {
      code: "function parse(value: Promise<unknown>) {}",
      errors: [error],
    },
    {
      code: "function parse(value: PromiseLike<unknown>) {}",
      errors: [error],
    },
    {
      code: "function parse(value: Awaited<unknown>) {}",
      errors: [error],
    },
    {
      code: "function parse(value: Awaited<Promise<unknown>>) {}",
      errors: [error],
    },
    {
      code: "namespace Domain { export type Input = unknown; } namespace Domain { export function parse(value: Input) {} }",
      errors: [error],
    },
    {
      code: "namespace Domain { export type Input = unknown; } function parse(value: Domain.Input) {}",
      errors: [error],
    },
    {
      code: "namespace Domain { export namespace Types { export type Input = unknown; } } function parse(value: Domain.Types.Input) {}",
      errors: [error],
    },
  ],
});
