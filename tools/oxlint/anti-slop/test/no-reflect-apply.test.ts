import { noReflectApplyRule } from "../rules/no-reflect-apply.ts";
import { ruleTester } from "./rule-tester.ts";

const error = { messageId: "reflectApply" };

ruleTester.run("anti-slop/no-reflect-apply", noReflectApplyRule, {
  valid: [
    "const Reflect = { apply(fn: Function, receiver: unknown, args: unknown[]) { return fn.apply(receiver, args); } }; (Reflect satisfies typeof Reflect).apply(fn, null, []);",
    "import { Reflect } from './owner'; (Reflect as typeof Reflect).apply(fn, null, []);",
    "import { Reflect } from './owner'; const reflection = Reflect; reflection.apply(fn, null, []);",
    "function call(Reflect: { apply(fn: Function, receiver: unknown, args: unknown[]): unknown }) { return (Reflect!).apply(fn, null, []); }",
    "const localReflect = { apply() {} }; const reflection = localReflect; reflection.apply(fn, null, []);",
    "let reflection = Reflect; reflection.apply(fn, null, []);",
    "const localReflect = { apply() {} }; const reflection = Reflect; reflection = localReflect; reflection.apply(fn, null, []);",
    "let apply = Reflect.apply; apply(fn, null, []);",
    "const localReflect = { apply() {} }; const apply = Reflect.apply; apply = localReflect.apply; apply(fn, null, []);",
    "const globalThis = { Reflect: { apply() {} } }; globalThis.Reflect.apply(fn, null, []);",
    "const globalThis = { Reflect: { apply() {} } }; globalThis['Reflect'].apply(fn, null, []);",
    "function call(globalThis: { Reflect: { apply(fn: Function, receiver: unknown, args: unknown[]): unknown } }) { return globalThis.Reflect.apply(fn, null, []); }",
    "let { apply: invoke } = Reflect; invoke(fn, null, []);",
    "const localReflect = { apply() {} }; const { apply: invoke } = Reflect; invoke = localReflect.apply; invoke(fn, null, []);",
    "const localApply = () => {}; const { apply: invoke = localApply } = Reflect; invoke(fn, null, []);",
    "const { ...reflection } = Reflect; reflection.apply(fn, null, []);",
    "const localReflect = { apply() {} }; const { apply: invoke } = localReflect; invoke(fn, null, []);",
    "const localReflect = { apply() {} }; localReflect.apply.call(localReflect, fn, null, []);",
    "const localReflect = { apply() {} }; const invoke = localReflect.apply; invoke.apply(localReflect, [fn, null, []]);",
    "const unrelated = () => {}; unrelated.call(null, fn, null, []); unrelated.apply(null, [fn, null, []]);",
    "let invoke = Reflect.apply.bind(Reflect); invoke(fn, null, []);",
    "const localApply = () => {}; const invoke = Reflect.apply.bind(Reflect); invoke = localApply; invoke(fn, null, []);",
    "const localReflect = { apply() {} }; const invoke = localReflect.apply.bind(localReflect); invoke(fn, null, []);",
    "const localBind = () => () => {}; const bind = Reflect.apply.bind; bind = localBind; const invoke = bind(Reflect); invoke(fn, null, []);",
    "const localCall = () => {}; const call = Reflect.apply.call; call = localCall; call(Reflect, fn, null, []);",
    "const invoke = Reflect.apply.bind(Reflect);",
    "const call = Reflect.apply.call; call(Reflect, fn, null, []);",
    "const bind = Reflect.apply.bind; const invoke = bind(Reflect); invoke(fn, null, []);",
    "const first = second; const second = first; first(fn, null, []);",
    "const first = second; const second = first; first.apply(fn, null, []);",
  ],
  invalid: [
    { code: "Reflect.apply(fn, null, []);", errors: [error] },
    {
      code: "(Reflect satisfies typeof Reflect).apply(fn, null, []);",
      errors: [error],
    },
    { code: "(Reflect as typeof Reflect).apply(fn, null, []);", errors: [error] },
    { code: "(<typeof Reflect>Reflect).apply(fn, null, []);", errors: [error] },
    { code: "(Reflect!).apply(fn, null, []);", errors: [error] },
    { code: "(Reflect).apply(fn, null, []);", errors: [error] },
    {
      code: "const reflection = Reflect; reflection.apply(fn, null, []);",
      errors: [error],
    },
    {
      code: "const first = Reflect; const reflection = first; reflection.apply(fn, null, []);",
      errors: [error],
    },
    {
      code: "const reflection = Reflect satisfies typeof Reflect; reflection.apply(fn, null, []);",
      errors: [error],
    },
    { code: "const apply = Reflect.apply; apply(fn, null, []);", errors: [error] },
    {
      code: "const apply = Reflect.apply; const invoke = apply; invoke(fn, null, []);",
      errors: [error],
    },
    {
      code: "const apply = Reflect.apply satisfies typeof Reflect.apply; apply(fn, null, []);",
      errors: [error],
    },
    { code: "globalThis.Reflect.apply(fn, null, []);", errors: [error] },
    { code: "globalThis['Reflect'].apply(fn, null, []);", errors: [error] },
    { code: "globalThis['Reflect']['apply'](fn, null, []);", errors: [error] },
    {
      code: "const reflection = globalThis.Reflect; reflection.apply(fn, null, []);",
      errors: [error],
    },
    {
      code: "const { get: read, apply: invoke } = Reflect; read(target, 'value'); invoke(fn, null, []);",
      errors: [error],
    },
    {
      code: "const { ['apply']: invoke } = Reflect; invoke(fn, null, []);",
      errors: [error],
    },
    {
      code: "const { apply } = globalThis.Reflect; apply(fn, null, []);",
      errors: [error],
    },
    { code: "Reflect.apply.call(Reflect, fn, null, []);", errors: [error] },
    { code: "Reflect.apply.apply(Reflect, [fn, null, []]);", errors: [error] },
    { code: "Reflect.apply['call'](Reflect, fn, null, []);", errors: [error] },
    {
      code: "const invoke = Reflect.apply; invoke.call(Reflect, fn, null, []);",
      errors: [error],
    },
    {
      code: "const { apply: invoke } = Reflect; invoke.apply(Reflect, [fn, null, []]);",
      errors: [error],
    },
    {
      code: "const invoke = Reflect.apply.bind(Reflect); invoke(fn, null, []);",
      errors: [error],
    },
    {
      code: "const method = Reflect.apply; const invoke = method.bind(Reflect); invoke(fn, null, []);",
      errors: [error],
    },
    {
      code: "Reflect.apply.bind(Reflect)(fn, null, []);",
      errors: [error],
    },
  ],
});
