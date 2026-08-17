import { noModuleMockingRule } from "../../rules/no-module-mocking.ts";
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
        vi!.mock("./service");
      }
    `,
    `
      export {};
      const globalThis = { vi: { mock(name: string): void {} } };
      globalThis!.vi.mock("./service");
    `,
    `
      import * as testApi from "./test-api";
      testApi!.vi.mock("./service");
    `,
    `
      import * as testApi from "vite-plus/test";
      testApi.vi.fn();
      globalThis!.vi.fn();
    `,
    `
      import * as testApi from "vite-plus/test";
      function register(testApi: { vi: { mock(name: string): void } }) {
        testApi.vi.mock("./service");
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
    {
      code: 'globalThis.vi.mock("./service");',
      errors: [{ messageId: "moduleMock" }],
    },
    {
      code: 'vi!.mock("./service");',
      errors: [{ messageId: "moduleMock" }],
    },
    {
      code: 'globalThis!.vi.mock("./service");',
      errors: [{ messageId: "moduleMock" }],
    },
    {
      code: '(vi satisfies typeof vi).mock("./service");',
      errors: [{ messageId: "moduleMock" }],
    },
    {
      code: '(<typeof vi>vi).mock("./service");',
      errors: [{ messageId: "moduleMock" }],
    },
    {
      code: `
        import * as testApi from "vite-plus/test";
        testApi.vi.mock("./service");
      `,
      errors: [{ messageId: "moduleMock" }],
    },
    {
      code: `
        import * as testApi from "vite-plus/test";
        testApi!.vi.mock("./service");
      `,
      errors: [{ messageId: "moduleMock" }],
    },
  ],
});
