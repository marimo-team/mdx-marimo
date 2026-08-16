import { noStructuralPlaceholderNamesRule } from "../rules/no-structural-placeholder-names.ts";
import { testRule } from "./rule-tester.ts";

testRule("no-structural-placeholder-names", noStructuralPlaceholderNamesRule, {
  valid: [
    `
      consume(shape);
      model.shape;
      model[shape];
      const options = { [shape]: value };
      const dynamicOptions = { [\`data\${suffix}Shape\`]: value };
    `,
    'import { dataShape as value } from "./model";',
    {
      code: "const view = <DataShape />;",
      filename: "view.tsx",
    },
  ],
  invalid: [
    {
      code: "const dataShape = value; consume(dataShape);",
      errors: [{ messageId: "forbiddenSymbolName" }],
    },
    {
      code: "const options = { dataShape: value };",
      errors: [{ messageId: "forbiddenSymbolName" }],
    },
    {
      code: "interface Model { dataShape: string }",
      errors: [{ messageId: "forbiddenSymbolName" }],
    },
    {
      code: 'import { value as dataShape } from "./model";',
      errors: [{ messageId: "forbiddenSymbolName" }],
    },
    {
      code: "function consume(dataShape: string) {}",
      errors: [{ messageId: "forbiddenSymbolName" }],
    },
    {
      code: "class Model { dataShape = value }",
      errors: [{ messageId: "forbiddenSymbolName" }],
    },
    {
      code: "type DataShape = string;",
      errors: [{ messageId: "forbiddenSymbolName" }],
    },
    {
      code: 'const options = { "dataShape": value };',
      errors: [{ messageId: "forbiddenSymbolName" }],
    },
    {
      code: 'const options = { ["dataShape"]: value };',
      errors: [{ messageId: "forbiddenSymbolName" }],
    },
    {
      code: "const options = { [`dataShape`]: value };",
      errors: [{ messageId: "forbiddenSymbolName" }],
    },
    {
      code: 'const options = { ["dataShape" as const]: value };',
      errors: [{ messageId: "forbiddenSymbolName" }],
    },
    {
      code: 'const options = { [("dataShape")!]: value };',
      errors: [{ messageId: "forbiddenSymbolName" }],
    },
    {
      code: 'interface Model { "dataShape": string }',
      errors: [{ messageId: "forbiddenSymbolName" }],
    },
    {
      code: 'class Model { "dataShape" = value }',
      errors: [{ messageId: "forbiddenSymbolName" }],
    },
    {
      code: 'enum Value { "dataShape" }',
      errors: [{ messageId: "forbiddenSymbolName" }],
    },
  ],
});
