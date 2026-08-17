import { noUnknownReturnsRule } from "../../rules/no-unknown-returns.ts";
import { testRule } from "./rule-tester.ts";

testRule("lexical type parameter scopes", noUnknownReturnsRule, {
  valid: [
    `
      type Raw = unknown;
      type Factory<T> = T extends infer Raw ? () => Raw : () => string;
    `,
  ],
  invalid: [
    {
      code: `
        type Raw = unknown;
        type Factory<T> = T extends (
          string extends infer Raw ? true : false
        ) ? () => Raw : () => string;
      `,
      errors: [{ messageId: "unknownReturn" }],
    },
  ],
});
