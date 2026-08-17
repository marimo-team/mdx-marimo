import { defineRule, type Context, type Rule, type VisitorWithHooks } from "@oxlint/plugins";

import antiSlopPlugin from "../index.ts";
import { ruleTester } from "./rule-tester.ts";

function createVisitors(name: string, context: Context): VisitorWithHooks {
  const rule: Rule | undefined = antiSlopPlugin.rules[name];
  if (rule === undefined) throw new Error(`Missing ${name} rule`);
  if (!("createOnce" in rule)) throw new Error("Expected a createOnce rule");
  return rule.createOnce(context);
}

const wideningRules = defineRule({
  meta: {
    messages: {
      widening: "Widening {{subject}} to {{target}}.",
      widenThenAssert: "Widening and asserting {{name}}.",
    },
  },
  createOnce(context) {
    const knownValue = createVisitors("no-known-value-widening", context);
    const widenThenAssert = createVisitors("no-widen-then-assert", context);

    return {
      Program(node) {
        knownValue.Program?.(node);
        widenThenAssert.Program?.(node);
      },
      VariableDeclarator(node) {
        knownValue.VariableDeclarator?.(node);
      },
      TSAsExpression(node) {
        knownValue.TSAsExpression?.(node);
        widenThenAssert.TSAsExpression?.(node);
      },
    };
  },
});

const errors = [{ messageId: "widening" }, { messageId: "widenThenAssert" }];
const errorsWithAssertionWidening = [
  { messageId: "widening" },
  { messageId: "widening" },
  { messageId: "widenThenAssert" },
];

ruleTester.run("anti-slop/widening-rules-integration", wideningRules, {
  valid: [],
  invalid: [
    {
      code: "interface Result { readonly [key: string]: number; readonly id: number } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
      errors,
    },
    {
      code: "type Result = { readonly [key: string]: number; readonly id: number }; const widened: Record<string, number> = { id: 1 }; const parsed = widened as Result;",
      errors,
    },
    {
      code: "namespace Domain { export interface Result { readonly id: number } } const widened: Record<string, number> = { id: 1 }; const parsed = widened as Domain.Result;",
      errors,
    },
    {
      code: "type Bag<Value> = Record<string, Value>; const widened: Bag<unknown> = { id: 1 }; const parsed = widened as { readonly id: number };",
      errors: errorsWithAssertionWidening,
    },
    {
      code: "interface Bag<Value> { readonly [key: string]: Value } const widened: Bag<unknown> = { id: 1 }; const parsed = widened as { readonly id: number };",
      errors: errorsWithAssertionWidening,
    },
  ],
});
