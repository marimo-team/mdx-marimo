import { noObjectParametersRule } from "../rules/no-object-parameters.ts";
import { ruleTester } from "./rule-tester.ts";

const error = { messageId: "objectParameter" };

ruleTester.run("anti-slop/no-object-parameters", noObjectParametersRule, {
  valid: [
    "type Alias = object; function outer() { type Alias = { readonly id: string }; function consume(value: Alias) {} }",
    "type Item = object; type Unpacked<Input> = Input extends Promise<infer Item> ? (value: Item) => void : never;",
    "type Readonly<T> = { readonly value: T }; type Partial<T> = { value?: T }; type Required<T> = { value: T }; type NonNullable<T> = { value: T }; function one(value: Readonly<object>) {} function two(value: Partial<object>) {} function three(value: Required<object>) {} function four(value: NonNullable<object>) {}",
    "import type { Readonly } from './owner'; function consume(value: Readonly<object>) {}",
    "namespace Domain { type Input = object; } namespace Domain { export function consume(value: Input) {} }",
    "import type * as Domain from './owner'; function consume(value: Domain.BroadObject) {}",
    "namespace Domain { export type BroadObject = object; } function outer<Domain>() { function consume(value: Domain.BroadObject) {} }",
    "function consume(value: object & { readonly id: number }) {}",
    "type Details = { readonly id: number }; function consume(value: object & Details) {}",
    "type Awaited<T> = { readonly value: T }; function consume(value: Awaited<object>) {}",
    "import type { Awaited } from './owner'; function consume(value: Awaited<object>) {}",
    "type Promise<T> = { readonly value: T }; function consume(value: Awaited<Promise<object>>) {}",
    "import type { PromiseLike } from './owner'; function consume(value: Awaited<PromiseLike<object>>) {}",
    "function consume(value: object & Record<string, string>) {}",
    "type Record<Key, Value> = { readonly key: Key; readonly value: Value }; function consume(value: object & Record<never, string>) {}",
    "import type { Record } from './owner'; function consume(value: object & Record<never, string>) {}",
    "function consume(value: object & { [Key in string]: string }) {}",
    "interface Owner { readonly id: string } function consume(value: object & Pick<Owner, 'id'>) {}",
    "type Pick<Owner, Key> = { readonly owner: Owner; readonly key: Key }; function consume(value: object & Pick<{ readonly id: string }, never>) {}",
    "import type { Pick } from './owner'; function consume(value: object & Pick<{ readonly id: string }, never>) {}",
  ],
  invalid: [
    {
      code: "function outer() { type Alias = object; function consume(value: Alias) {} }",
      errors: [error],
    },
    {
      code: "function outer() { function consume(value: Alias) {} type Alias = object; }",
      errors: [error],
    },
    {
      code: "type Box<T> = T; function consume(value: Box<object>) {}",
      errors: [error],
    },
    {
      code: "type Identity<T> = T; function consume(value: Identity<Identity<object>>) {}",
      errors: [error],
    },
    {
      code: "namespace Domain { export type BroadObject = object; } function consume(value: Domain.BroadObject) {}",
      errors: [error],
    },
    {
      code: "namespace Domain { export type Box<T> = T; } function consume(value: Domain.Box<object>) {}",
      errors: [error],
    },
    {
      code: "function consume(value: object & {}) {}",
      errors: [error],
    },
    {
      code: "type Empty = {}; function consume(value: object & Empty) {}",
      errors: [error],
    },
    {
      code: "function consume(value: Awaited<object>) {}",
      errors: [error],
    },
    {
      code: "function consume(value: Awaited<Promise<object>>) {}",
      errors: [error],
    },
    {
      code: "function consume(value: Awaited<PromiseLike<object>>) {}",
      errors: [error],
    },
    {
      code: "type Result<T> = Promise<T>; function consume(value: Awaited<Result<object>>) {}",
      errors: [error],
    },
    {
      code: "type Awaited<T> = T; function consume(value: Awaited<object>) {}",
      errors: [error],
    },
    {
      code: "function consume(value: object & Record<never, string>) {}",
      errors: [error],
    },
    {
      code: "type EmptyRecord<Key> = Record<Key, string>; function consume(value: object & EmptyRecord<never>) {}",
      errors: [error],
    },
    {
      code: "function consume(value: object & { [Key in never]: string }) {}",
      errors: [error],
    },
    {
      code: "type NoKeys = never; function consume(value: object & { [Key in NoKeys]: string }) {}",
      errors: [error],
    },
    {
      code: "type EmptyMapped<Key> = { [Member in Key]: string }; function consume(value: object & EmptyMapped<never>) {}",
      errors: [error],
    },
    {
      code: "interface Owner { readonly id: string } function consume(value: object & Pick<Owner, never>) {}",
      errors: [error],
    },
    {
      code: "interface Owner { readonly id: string } type EmptyPick<Key extends keyof Owner> = Pick<Owner, Key>; function consume(value: object & EmptyPick<never>) {}",
      errors: [error],
    },
    {
      code: "function one(value: Readonly<object>) {} function two(value: Partial<object>) {} function three(value: Required<object>) {} function four(value: NonNullable<object>) {}",
      errors: [error, error, error, error],
    },
    {
      code: "type Alias = { readonly id: string }; function outer() { type Alias = object; function consume(value: Alias) {} }",
      errors: [error],
    },
    {
      code: "namespace Domain { type Alias = object; export function consume(value: Alias) {} }",
      errors: [error],
    },
    {
      code: "namespace Domain { export type Input = object; } namespace Domain { export function consume(value: Input) {} }",
      errors: [error],
    },
    {
      code: "type Item = object; type Result<Input> = Input extends (Input extends Array<infer Item> ? string[] : string) ? (value: Item) => void : never;",
      errors: [error],
    },
  ],
});
