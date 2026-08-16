import { noModuleMockingRule } from "../rules/no-module-mocking.ts";
import { testRule } from "./rule-tester.ts";

testRule("no-module-mocking", noModuleMockingRule, {
  valid: [
    `
      import { vi } from "vite-plus/test";
      const callback = vi.fn();
    `,
    `
      function register(vi: { mock(name: string): void }) {
        (vi?.mock)("./service");
      }
    `,
  ],
  invalid: [
    {
      code: `
        import { vi } from "vite-plus/test";
        vi.mock("./service");
      `,
      errors: [{ messageId: "moduleMock" }],
    },
    {
      code: `
        import { vi as testApi } from "vite-plus/test";
        testApi.doMock("./service");
      `,
      errors: [{ messageId: "moduleMock" }],
    },
    {
      code: `
        import { vi } from "vite-plus/test";
        vi?.mock("./service");
      `,
      errors: [{ messageId: "moduleMock" }],
    },
    {
      code: `
        import { vi } from "vite-plus/test";
        (vi?.mock)("./service");
      `,
      errors: [{ messageId: "moduleMock" }],
    },
    {
      code: `
        import { vi } from "vite-plus/test";
        (vi.mock)("./service");
      `,
      errors: [{ messageId: "moduleMock" }],
    },
    {
      code: `
        import { vi } from "vite-plus/test";
        vi[\`mock\`]("./service");
      `,
      errors: [{ messageId: "moduleMock" }],
    },
    {
      code: `
        import { vi } from "vite-plus/test";
        vi["mock" as const]("./service");
      `,
      errors: [{ messageId: "moduleMock" }],
    },
    {
      code: `
        import { vi } from "vite-plus/test";
        vi["mock" satisfies string]("./service");
      `,
      errors: [{ messageId: "moduleMock" }],
    },
  ],
});
