import { noModuleMockingRule } from "../rules/no-module-mocking.ts";
import { ruleTester } from "./rule-tester.ts";

const error = { messageId: "moduleMock" };

ruleTester.run("anti-slop/no-module-mocking", noModuleMockingRule, {
  valid: [
    "import { vi as localVi } from './helpers'; localVi.mock('./module');",
    "import { vi as localVi } from './helpers'; (localVi satisfies typeof localVi).mock('./module');",
    "import { vi as localVi } from './helpers'; const testApi = localVi; testApi.mock('./module');",
    "import * as testApi from './helpers'; testApi.vi.mock('./module');",
    "import * as testApi from './helpers'; (testApi.vi satisfies typeof testApi.vi).mock('./module');",
    "const vi = { mock() {} }; vi.mock('./module');",
    "const vi = { mock() {} }; (vi as typeof vi).mock('./module');",
    "const vi = { mock() {} }; const testApi = vi; testApi.mock('./module');",
    "import { vi } from 'vite-plus/test'; let testApi = vi; testApi.mock('./module');",
    "import { vi } from 'vite-plus/test'; const localApi = { mock() {} }; const testApi = vi; testApi = localApi; testApi.mock('./module');",
    "import { vi } from 'vite-plus/test'; let mockModule = vi.mock; mockModule('./module');",
    "import { vi } from 'vite-plus/test'; const localMock = () => {}; const mockModule = vi.mock; mockModule = localMock; mockModule('./module');",
    "import { vi } from 'vite-plus/test'; let { mock: mockModule } = vi; mockModule('./module');",
    "import { vi } from 'vite-plus/test'; const localMock = () => {}; const { mock: mockModule = localMock } = vi; mockModule('./module');",
    "import { vi } from 'vite-plus/test'; const { ...testApi } = vi; testApi.mock('./module');",
    "const localVi = { mock() {} }; const { mock: mockModule } = localVi; mockModule('./module');",
    "import { vi as localVi } from './helpers'; const mockModule = localVi.mock; mockModule('./module');",
    "import * as testApi from './helpers'; const mockModule = testApi.vi.mock; mockModule('./module');",
    "import vi = require('./helpers'); vi.mock('./module');",
    "import globalThis = require('./helpers'); globalThis.vi.mock('./module');",
    "const localVi = { mock() {} }; localVi.mock.call(localVi, './module');",
    "const localVi = { mock() {} }; const mockModule = localVi.mock; mockModule.apply(localVi, ['./module']);",
    "const unrelated = () => {}; unrelated.call(null, './module'); unrelated.apply(null, ['./module']);",
    "import { vi } from 'vite-plus/test'; let mockModule = vi.mock.bind(vi); mockModule('./module');",
    "import { vi } from 'vite-plus/test'; const localMock = () => {}; const mockModule = vi.mock.bind(vi); mockModule = localMock; mockModule('./module');",
    "const localVi = { mock() {} }; const mockModule = localVi.mock.bind(localVi); mockModule('./module');",
    "import { vi } from 'vite-plus/test'; const localBind = () => () => {}; const bind = vi.mock.bind; bind = localBind; const mockModule = bind(vi); mockModule('./module');",
    "import { vi } from 'vite-plus/test'; const localCall = () => {}; const invoke = vi.mock.call; invoke = localCall; invoke(vi, './module');",
    "import { vi } from 'vite-plus/test'; const mockModule = vi.mock.bind(vi);",
    "import { vi } from 'vite-plus/test'; const invoke = vi.mock.call; invoke(vi, './module');",
    "import { vi } from 'vite-plus/test'; const bind = vi.unstable_mockModule.bind; const mockModule = bind(vi); mockModule('./module');",
    "const first = second; const second = first; first.mock('./module');",
    "const first = second; const second = first; first.vi.mock('./module');",
    "const first = second; const second = first; first('./module');",
  ],
  invalid: [
    {
      code: "import { vi } from 'vite-plus/test'; vi.mock('./module');",
      errors: [error],
    },
    {
      code: "import { vi as testApi } from 'vite-plus/test'; testApi.doMock('./module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; (vi satisfies typeof vi).mock('./module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; (vi as typeof vi).mock('./module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; (<typeof vi>vi).mock('./module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; (vi!).mock('./module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; (vi).mock('./module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; const testApi = vi; testApi.mock('./module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; const first = vi; const second = first; second.doMock('./module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; const testApi = vi satisfies typeof vi; (testApi!).mock('./module');",
      errors: [error],
    },
    {
      code: "import * as testApi from 'vite-plus/test'; testApi.vi.mock('./module');",
      errors: [error],
    },
    {
      code: "import * as testApi from 'vitest'; testApi.vi.doMock('./module');",
      errors: [error],
    },
    {
      code: "import * as testApi from 'vite-plus/test'; (testApi.vi satisfies typeof testApi.vi).mock('./module');",
      errors: [error],
    },
    {
      code: "import * as testApi from 'vitest'; (testApi.vi as typeof testApi.vi).mock('./module');",
      errors: [error],
    },
    {
      code: "import * as testApi from 'vite-plus/test'; const localVi = testApi.vi; localVi.mock('./module');",
      errors: [error],
    },
    {
      code: "import * as testApi from 'vite-plus/test'; const namespace = testApi; namespace.vi.mock('./module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; const mockModule = vi.mock; mockModule('./module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; const first = vi.mock; const mockModule = first; mockModule('./module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; const { mock: mockModule } = vi; mockModule('./module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; const { doMock } = vi; doMock('./module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; const { ['unstable_mockModule']: mockModule } = vi; mockModule('./module');",
      errors: [error],
    },
    {
      code: "import * as testApi from 'vite-plus/test'; const mockModule = testApi.vi.mock; mockModule('./module');",
      errors: [error],
    },
    {
      code: "import * as testApi from 'vitest'; const { doMock: mockModule } = testApi.vi; mockModule('./module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; vi.mock.call(vi, './module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; vi.mock.apply(vi, ['./module']);",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; const mockModule = vi.mock; mockModule.call(vi, './module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; const mockModule = vi.mock.bind(vi); mockModule('./module');",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; const method = vi.doMock; const mockModule = method.bind(vi); mockModule('./module');",
      errors: [error],
    },
    {
      code: "import * as testApi from 'vitest'; testApi.vi.mock.apply(testApi.vi, ['./module']);",
      errors: [error],
    },
    {
      code: "import { vi } from 'vite-plus/test'; vi.mock.bind(vi)('./module');",
      errors: [error],
    },
  ],
});
