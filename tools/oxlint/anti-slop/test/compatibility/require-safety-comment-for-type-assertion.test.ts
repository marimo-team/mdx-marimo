import { requireSafetyCommentForTypeAssertionRule } from "../../rules/require-safety-comment-for-type-assertion.ts";
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
    `
        // SAFETY: The decoder established the string contract.
        const value = (() => source as string)();
      `,
    `
        function read() {
          // SAFETY: The decoder established the string contract.
          return (() => source as string)();
        }
      `,
    `
        const value = (function () {
          // SAFETY: The decoder established the string contract.
          return source as string;
        })();
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
    {
      code: `
          // SAFETY: The callback registration is controlled by this module.
          const callback = () => source as string;
        `,
      errors: [{ messageId: "missingSafetyComment" }],
    },
    {
      code: `
          // SAFETY: The callback registration is controlled by this module.
          const callback = () => () => source as string;
        `,
      errors: [{ messageId: "missingSafetyComment" }],
    },
    {
      code: `
          // SAFETY: The callback registration is controlled by this module.
          const callback = function (value = source as string) {};
        `,
      errors: [{ messageId: "missingSafetyComment" }],
    },
    {
      code: `
          // SAFETY: The invocation is controlled by this module.
          const value = (function (input = source as string) { return input; })();
        `,
      errors: [{ messageId: "missingSafetyComment" }],
    },
    {
      code: `
          // SAFETY: The class registration is controlled by this module.
          const Model = class extends (source as Constructor) {};
        `,
      errors: [{ messageId: "missingSafetyComment" }],
    },
  ],
});
