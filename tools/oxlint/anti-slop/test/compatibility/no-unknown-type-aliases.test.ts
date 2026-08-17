import { noUnknownTypeAliasesRule } from "../../rules/no-unknown-type-aliases.ts";
import { testRule } from "./rule-tester.ts";

testRule("no-unknown-type-aliases", noUnknownTypeAliasesRule, {
  valid: ["type Value = string | number;"],
  invalid: [
    {
      code: "type Value = unknown | string;",
      errors: [{ messageId: "unknownAlias" }],
    },
    {
      code: "function owner() { type Value = unknown; return null as Value; }",
      errors: [{ messageId: "unknownAlias" }],
    },
    {
      code: "namespace Payload { export type Value = unknown; }",
      errors: [{ messageId: "unknownAlias" }],
    },
    {
      code: "type Identity<Value> = Value; type Hidden = Identity<unknown>;",
      errors: [{ messageId: "unknownAlias" }],
    },
    {
      code: "type Identity<Value = unknown> = Value; type Hidden = Identity;",
      errors: [{ messageId: "unknownAlias" }],
    },
    {
      code: "type Identity<Value> = Value; type Wrapped<Value> = Identity<Value>; type Hidden = Wrapped<unknown>;",
      errors: [{ messageId: "unknownAlias" }],
    },
  ],
});
