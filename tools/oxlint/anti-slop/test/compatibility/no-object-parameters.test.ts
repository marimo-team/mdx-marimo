import { noObjectParametersRule } from "../../rules/no-object-parameters.ts";
import { testRule } from "./rule-tester.ts";

testRule("no-object-parameters", noObjectParametersRule, {
  valid: [
    `
      type Input = object;
      function owner() {
        type Input = string;
        function read(value: Input) { return value; }
        return read;
      }
    `,
    "type Identity<Value> = Value; function read<Value>(input: Identity<Value>) { return input; }",
  ],
  invalid: [
    {
      code: "function read(input: object = {}) { return input; }",
      errors: [
        {
          messageId: "objectParameter",
          data: { parameter: "input" },
        },
      ],
    },
    {
      code: "function owner() { type Input = object; function read(value: Input) { return value; } }",
      errors: [{ messageId: "objectParameter" }],
    },
    {
      code: "type Input = object; function owner() { const Input = 1; function read(value: Input) { return value; } return Input; }",
      errors: [{ messageId: "objectParameter" }],
    },
    {
      code: "function read(...input: object) { return input; }",
      errors: [
        {
          messageId: "objectParameter",
          data: { parameter: "input" },
        },
      ],
    },
    {
      code: "class Reader { constructor(public input: object) {} }",
      errors: [
        {
          messageId: "objectParameter",
          data: { parameter: "input" },
        },
      ],
    },
    {
      code: "type Identity<Value> = Value; function read(input: Identity<object>) { return input; }",
      errors: [{ messageId: "objectParameter" }],
    },
    {
      code: "type Identity<Value = object> = Value; function read(input: Identity) { return input; }",
      errors: [{ messageId: "objectParameter" }],
    },
    {
      code: "type Identity<Value> = Value; type Wrapped<Value> = Identity<Value>; function read(input: Wrapped<object>) { return input; }",
      errors: [{ messageId: "objectParameter" }],
    },
  ],
});
