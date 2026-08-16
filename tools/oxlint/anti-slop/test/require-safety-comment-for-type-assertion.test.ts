import { requireSafetyCommentForTypeAssertionRule } from "../rules/require-safety-comment-for-type-assertion.ts";
import { testRule } from "./rule-tester.ts";

testRule("require-safety-comment-for-type-assertion", requireSafetyCommentForTypeAssertionRule, {
  valid: [
    `
        // SAFETY: The decoder established the string contract.
        const value = source as string;
      `,
    `
        // SAFETY: The preceding decoder established the boolean contract.
        if (value as boolean) consume(value);
      `,
  ],
  invalid: [
    {
      code: `
          // SAFETY: The function registration is controlled by this module.
          function consume(value: unknown) {
            if (value as boolean) return;
          }
        `,
      errors: [{ messageId: "missingSafetyComment" }],
    },
    {
      code: `
          // SAFETY: The class registration is controlled by this module.
          class Consumer {
            [value as string]() {}
          }
        `,
      errors: [{ messageId: "missingSafetyComment" }],
    },
    {
      code: `
          // SAFETY: The function registration is controlled by this module.
          function consume(value = source as string) {}
        `,
      errors: [{ messageId: "missingSafetyComment" }],
    },
  ],
});
