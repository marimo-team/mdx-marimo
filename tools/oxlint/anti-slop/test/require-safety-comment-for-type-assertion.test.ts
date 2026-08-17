import { requireSafetyCommentForTypeAssertionRule } from "../rules/require-safety-comment-for-type-assertion.ts";
import { ruleTester } from "./rule-tester.ts";

const error = { messageId: "missingSafetyComment" };

ruleTester.run(
  "anti-slop/require-safety-comment-for-type-assertion",
  requireSafetyCommentForTypeAssertionRule,
  {
    valid: [
      "function check(value: unknown) { // SAFETY: Validation established the string invariant.\nif (value as string) return true; return false; }",
      "function check(value: unknown) { inspect();\n// SAFETY: Validation established the string invariant.\nreturn value as string; }",
      "function check(value: unknown) { return /* SAFETY: Validation established the string invariant. */ value as string; }",
      "// SAFETY: Validation established the owner contract.\nexport const value = input as Owner;",
      "class Registry { // SAFETY: Validation established the member name.\n[input as string](): void {} }",
      "const registry = { // SAFETY: Validation established the property name.\n[input as string]: value };",
    ],
    invalid: [
      {
        code: "// SAFETY: The function validates its result.\nfunction check(value: unknown) { if (value as string) return true; return false; }",
        errors: [error],
      },
      {
        code: "function check(value: unknown) { // SAFETY: The branch validates its result.\nif (ready) { return value as string; } return ''; }",
        errors: [error],
      },
      {
        code: "function check(value: unknown) { inspect(); // SAFETY: Validation established the string invariant.\nreturn value as string; }",
        errors: [error],
      },
      {
        code: "const unrelated = inspect(); // SAFETY: Validation established the owner contract.\nexport const value = input as Owner;",
        errors: [error],
      },
      {
        code: "class Registry { previous(): void {} // SAFETY: Validation established the member name.\n[input as string](): void {} }",
        errors: [error],
      },
      {
        code: "const registry = { previous: true, // SAFETY: Validation established the property name.\n[input as string]: value };",
        errors: [error],
      },
    ],
  },
);
