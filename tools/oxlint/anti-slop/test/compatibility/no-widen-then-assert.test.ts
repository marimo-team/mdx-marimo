import { noWidenThenAssertRule } from "../../rules/no-widen-then-assert.ts";
import { testRule } from "./rule-tester.ts";

testRule("no-widen-then-assert", noWidenThenAssertRule, {
  valid: [
    `
      type Record<Key, Value> = { key: Key; value: Value };
      const value: Record<string, unknown> = { key: "name", value: 1 };
      value as { key: string; value: number };
    `,
  ],
  invalid: [
    {
      code: `
        const value: Record<string, unknown> = { name: "Ada" };
        value as { name: string };
      `,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      code: `
        const Record = 1;
        const value: Record<string, unknown> = { name: "Ada" };
        value as { name: string };
      `,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      code: `
        const value: Record<string | "first", unknown> = { name: "Ada" };
        value as { name: string };
      `,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      code: `
        const value: Record<PropertyKey | "first", unknown> = { name: "Ada" };
        value as { name: string };
      `,
      errors: [{ messageId: "widenThenAssert" }],
    },
    {
      code: `
        const value: Record<keyof any, unknown> = { name: "Ada" };
        value as { name: string };
      `,
      errors: [{ messageId: "widenThenAssert" }],
    },
  ],
});
