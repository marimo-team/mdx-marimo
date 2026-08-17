import { noReflectGetRule } from "../rules/no-reflect-get.ts";
import { ruleTester } from "./rule-tester.ts";

const error = { messageId: "reflectGet" };

ruleTester.run("anti-slop/no-reflect-get", noReflectGetRule, {
  valid: [
    "const Reflect = { get(target: object, key: PropertyKey) { return target[key]; } }; (Reflect satisfies typeof Reflect).get(target, 'value');",
    "import { Reflect } from './owner'; (Reflect as typeof Reflect).get(target, 'value');",
    "import { Reflect } from './owner'; const reflection = Reflect; reflection.get(target, 'value');",
    "function read(Reflect: { get(target: object, key: PropertyKey): unknown }) { return (Reflect!).get(target, 'value'); }",
    "const localReflect = { get() {} }; const reflection = localReflect; reflection.get(target, 'value');",
    "let reflection = Reflect; reflection.get(target, 'value');",
    "const localReflect = { get() {} }; const reflection = Reflect; reflection = localReflect; reflection.get(target, 'value');",
    "let read = Reflect.get; read(target, 'value');",
    "const localReflect = { get() {} }; const read = Reflect.get; read = localReflect.get; read(target, 'value');",
    "const globalThis = { Reflect: { get() {} } }; globalThis.Reflect.get(target, 'value');",
    "const globalThis = { Reflect: { get() {} } }; globalThis['Reflect'].get(target, 'value');",
    "function read(globalThis: { Reflect: { get(target: object, key: PropertyKey): unknown } }) { return globalThis.Reflect.get(target, 'value'); }",
    "let { get: read } = Reflect; read(target, 'value');",
    "const localReflect = { get() {} }; const { get: read } = Reflect; read = localReflect.get; read(target, 'value');",
    "const localRead = () => {}; const { get: read = localRead } = Reflect; read(target, 'value');",
    "const { ...reflection } = Reflect; reflection.get(target, 'value');",
    "const localReflect = { get() {} }; const { get: read } = localReflect; read(target, 'value');",
    "const localReflect = { get() {} }; localReflect.get.call(localReflect, target, 'value');",
    "const localReflect = { get() {} }; const read = localReflect.get; read.apply(localReflect, [target, 'value']);",
    "const unrelated = () => {}; unrelated.call(null, target, 'value'); unrelated.apply(null, [target, 'value']);",
    "let read = Reflect.get.bind(Reflect); read(target, 'value');",
    "const localRead = () => {}; const read = Reflect.get.bind(Reflect); read = localRead; read(target, 'value');",
    "const localReflect = { get() {} }; const read = localReflect.get.bind(localReflect); read(target, 'value');",
    "const localBind = () => () => {}; const bind = Reflect.get.bind; bind = localBind; const read = bind(Reflect); read(target, 'value');",
    "const localCall = () => {}; const invoke = Reflect.get.call; invoke = localCall; invoke(Reflect, target, 'value');",
    "const read = Reflect.get.bind(Reflect);",
    "const invoke = Reflect.get.call; invoke(Reflect, target, 'value');",
    "const bind = Reflect.get.bind; const read = bind(Reflect); read(target, 'value');",
    "const first = second; const second = first; first(target, 'value');",
    "const first = second; const second = first; first.get(target, 'value');",
  ],
  invalid: [
    { code: "Reflect.get(target, 'value');", errors: [error] },
    {
      code: "(Reflect satisfies typeof Reflect).get(target, 'value');",
      errors: [error],
    },
    { code: "(Reflect as typeof Reflect).get(target, 'value');", errors: [error] },
    { code: "(<typeof Reflect>Reflect).get(target, 'value');", errors: [error] },
    { code: "(Reflect!).get(target, 'value');", errors: [error] },
    { code: "(Reflect).get(target, 'value');", errors: [error] },
    {
      code: "const reflection = Reflect; reflection.get(target, 'value');",
      errors: [error],
    },
    {
      code: "const first = Reflect; const reflection = first; reflection.get(target, 'value');",
      errors: [error],
    },
    {
      code: "const reflection = Reflect satisfies typeof Reflect; reflection.get(target, 'value');",
      errors: [error],
    },
    { code: "const read = Reflect.get; read(target, 'value');", errors: [error] },
    {
      code: "const read = Reflect.get; const invoke = read; invoke(target, 'value');",
      errors: [error],
    },
    {
      code: "const read = Reflect.get satisfies typeof Reflect.get; read(target, 'value');",
      errors: [error],
    },
    { code: "globalThis.Reflect.get(target, 'value');", errors: [error] },
    { code: "globalThis['Reflect'].get(target, 'value');", errors: [error] },
    { code: "globalThis['Reflect']['get'](target, 'value');", errors: [error] },
    {
      code: "const reflection = globalThis.Reflect; reflection.get(target, 'value');",
      errors: [error],
    },
    {
      code: "const { get: read, apply: invoke } = Reflect; read(target, 'value'); invoke(fn, null, []);",
      errors: [error],
    },
    {
      code: "const { ['get']: read } = Reflect; read(target, 'value');",
      errors: [error],
    },
    {
      code: "const { get } = globalThis.Reflect; get(target, 'value');",
      errors: [error],
    },
    { code: "Reflect.get.call(Reflect, target, 'value');", errors: [error] },
    { code: "Reflect.get.apply(Reflect, [target, 'value']);", errors: [error] },
    { code: "Reflect.get['call'](Reflect, target, 'value');", errors: [error] },
    {
      code: "const read = Reflect.get; read.call(Reflect, target, 'value');",
      errors: [error],
    },
    {
      code: "const { get: read } = Reflect; read.apply(Reflect, [target, 'value']);",
      errors: [error],
    },
    {
      code: "const read = Reflect.get.bind(Reflect); read(target, 'value');",
      errors: [error],
    },
    {
      code: "const method = Reflect.get; const read = method.bind(Reflect); read(target, 'value');",
      errors: [error],
    },
    {
      code: "Reflect.get.bind(Reflect)(target, 'value');",
      errors: [error],
    },
  ],
});
