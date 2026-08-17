import { noChainedTypeAssertionsRule } from "../rules/no-chained-type-assertions.ts";
import { ruleTester } from "./rule-tester.ts";

const error = { messageId: "chained" };

ruleTester.run("anti-slop/no-chained-type-assertions", noChainedTypeAssertionsRule, {
  valid: [
    "const value = (input satisfies object) as object;",
    "const value = (input as const) satisfies object;",
    "const value = (input!) as object;",
    "const value = (input as const)!;",
    "const value = ((input as const) satisfies object) as const;",
    "// SAFETY: Boundary data remains intentionally opaque.\nlet bridge = readExternal() as unknown; bridge = readExternal();\n// SAFETY: The caller validates the result contract.\nconst value = bridge as Result;",
    "const bridge = readExternal();\n// SAFETY: The caller validates the result contract.\nconst value = bridge as Result;",
    "// SAFETY: The nested value remains intentionally opaque.\nconst bridge = { value: readExternal() as unknown };\n// SAFETY: The caller validates the aggregate contract.\nconst value = bridge as Result;",
    "// SAFETY: Boundary data remains intentionally opaque.\nconst bridge = readExternal() as unknown; function create() { const bridge = readExternal();\n// SAFETY: The caller validates the result contract.\nreturn bridge as Result; }",
    "const first = second; const second = first;\n// SAFETY: The caller validates the result contract.\nconst value = first as Result;",
    "// SAFETY: Both assertions preserve their independently checked contracts.\nconst value = (readExternal() as unknown, touch()) as Result;",
    "// SAFETY: Boundary data remains intentionally opaque.\nconst bridge = (readExternal() as unknown, touch());\n// SAFETY: The caller validates the result contract.\nconst value = bridge as Result;",
    "// SAFETY: The caller validates the selected result contract.\nconst value = (condition ? first : second) as Result;",
    "const value = (condition ? ({ first } as const) : ({ second } as const)) as const;",
    "// SAFETY: Both assertions preserve the boolean transformation.\nconst value = (!(input as unknown)) as boolean;",
    "// SAFETY: Both assertions preserve the comparison result.\nconst value = ((input as unknown) === other) as boolean;",
  ],
  invalid: [
    {
      code: "const value = ((input as const) satisfies object) as object;",
      errors: [error],
    },
    {
      code: "const value = (input as const)! as object;",
      errors: [error],
    },
    {
      code: "const value = ((input as object) satisfies object) as const;",
      errors: [error],
    },
    {
      code: "// SAFETY: Boundary data remains intentionally opaque.\nconst bridge = readExternal() as unknown;\n// SAFETY: The caller validates the result contract.\nconst value = bridge as Result;",
      errors: [error],
    },
    {
      code: "// SAFETY: Boundary data remains intentionally opaque.\nconst bridge = readExternal() as unknown; const alias = bridge; const narrowed = alias;\n// SAFETY: The caller validates the result contract.\nconst value = narrowed as Result;",
      errors: [error],
    },
    {
      code: "// SAFETY: The boundary and result contracts are checked externally.\nconst value = (touch(), readExternal() as unknown) as Result;",
      errors: [error],
    },
    {
      code: "// SAFETY: Boundary data remains intentionally opaque.\nconst bridge = (touch(), readExternal() as unknown);\n// SAFETY: The caller validates the result contract.\nconst value = bridge as Result;",
      errors: [error],
    },
    {
      code: "// SAFETY: The branch and result contracts are checked externally.\nconst value = (condition ? first as unknown : second) as Result;",
      errors: [error],
    },
    {
      code: "// SAFETY: The branch and result contracts are checked externally.\nconst value = (condition ? first as unknown : second as unknown) as Result;",
      errors: [error],
    },
    {
      code: "// SAFETY: The operand and result contracts are checked externally.\nconst value = ((first as unknown) && second) as Result;",
      errors: [error],
    },
    {
      code: "// SAFETY: The operand and result contracts are checked externally.\nconst value = (first || (second as unknown)) as Result;",
      errors: [error],
    },
    {
      code: "// SAFETY: The operand and result contracts are checked externally.\nconst value = (first ?? (second as unknown)) as Result;",
      errors: [error],
    },
  ],
});
