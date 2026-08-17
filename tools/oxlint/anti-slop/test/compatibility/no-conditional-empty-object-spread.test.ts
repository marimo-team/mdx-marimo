import { noConditionalEmptyObjectSpreadRule } from "../../rules/no-conditional-empty-object-spread.ts";
import { testRule } from "./rule-tester.ts";

testRule("no-conditional-empty-object-spread", noConditionalEmptyObjectSpreadRule, {
  valid: [
    "const options = enabled ? { enabled } : { enabled: false };",
    "const options = { ...defaults };",
  ],
  invalid: [
    {
      code: "const options = { ...((enabled ? { enabled } : {}) as object) };",
      errors: [{ messageId: "avoid" }],
    },
    {
      code: "const options = { ...(<object>(enabled ? { enabled } : {})) };",
      errors: [{ messageId: "avoid" }],
    },
    {
      code: "const options = { ...((enabled ? { enabled } : {}) satisfies object) };",
      errors: [{ messageId: "avoid" }],
    },
    {
      code: "const options = { ...(enabled ? { enabled } : {})! };",
      errors: [{ messageId: "avoid" }],
    },
    {
      code: "const options = { ...(enabled ? { enabled } : ({} as object)) };",
      errors: [{ messageId: "avoid" }],
    },
  ],
});
