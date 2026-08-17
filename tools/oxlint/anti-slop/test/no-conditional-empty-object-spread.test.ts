import { noConditionalEmptyObjectSpreadRule } from "../rules/no-conditional-empty-object-spread.ts";
import { ruleTester } from "./rule-tester.ts";

const error = { messageId: "avoid" };

ruleTester.run("anti-slop/no-conditional-empty-object-spread", noConditionalEmptyObjectSpreadRule, {
  valid: [
    "const result = { ...(condition ? { value } : { fallback: value }) };",
    "const result = { ...(condition ? ({ value } as const) : { fallback: value }) };",
    "const result = { ...(condition ? ({ value } satisfies object) : { fallback: value }) };",
    "const result = { ...(condition ? (<object>{ value }) : { fallback: value }) };",
    "const result = { ...(condition ? ({ value }!) : { fallback: value }) };",
    "const result = { ...(first ? (second ? { first } : { second }) : { fallback }) };",
    "const result = { ...(first ? { first } : (second ? { second } : { fallback })) };",
    "let fields = condition ? {} : { value }; fields = { value }; const result = { ...fields };",
    "const fields = condition ? {} : { value }; { const fields = load(); const result = { ...fields }; }",
    "const first = second; const second = first; const result = { ...first };",
    "const fields = load(); const result = { ...fields };",
  ],
  invalid: [
    {
      code: "const result = { ...(condition ? {} : { value }) };",
      errors: [error],
    },
    {
      code: "const result = { ...(condition ? ({}) : { value }) };",
      errors: [error],
    },
    {
      code: "const result = { ...(condition ? { value } : ({})) };",
      errors: [error],
    },
    {
      code: "const result = { ...(condition ? ({} as const) : { value }) };",
      errors: [error],
    },
    {
      code: "const result = { ...(condition ? ({} satisfies object) : { value }) };",
      errors: [error],
    },
    {
      code: "const result = { ...(condition ? (<object>{}) : { value }) };",
      errors: [error],
    },
    {
      code: "const result = { ...(condition ? ({}!) : { value }) };",
      errors: [error],
    },
    {
      code: "const result = { ...((condition ? {} : { value }) as object) };",
      errors: [error],
    },
    {
      code: "const result = { ...(first ? (second ? {} : { second }) : { fallback }) };",
      errors: [error],
    },
    {
      code: "const result = { ...(first ? { first } : (second ? { second } : {})) };",
      errors: [error],
    },
    {
      code: "const fields = condition ? {} : { value }; const result = { ...fields };",
      errors: [error],
    },
    {
      code: "const fields = condition ? {} : { value }; const alias = fields; const spread = alias; const result = { ...spread };",
      errors: [error],
    },
  ],
});
