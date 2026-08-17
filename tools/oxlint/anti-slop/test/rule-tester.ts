import { describe, test } from "node:test";
import { RuleTester } from "oxlint/plugins-dev";

RuleTester.describe = describe;
RuleTester.it = test;

export const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: { lang: "ts" },
  },
});
