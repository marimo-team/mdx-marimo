import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MarimoCellOptions, MarimoPageRequest, MarimoPageResult } from "../src/schema";

const pythonHarness = String.raw`
import asyncio
from dataclasses import dataclass
import importlib.util
import json
import sys
import types


@dataclass
class AppInstantiation:
    options: dict


@dataclass
class CellDef:
    code: str
    name: str
    options: dict


@dataclass
class NotebookSerializationV1:
    app: AppInstantiation
    filename: str | None
    cells: list


class Stub:
    def __init__(self, index):
        self.index = index

    def render(self, display_code, display_output, is_reactive):
        return json.dumps({
            "displayCode": display_code,
            "displayOutput": display_output,
            "index": self.index,
            "reactive": is_reactive,
        })


class MarimoIslandGenerator:
    def __init__(self, app_id):
        self.app_id = app_id
        self._stubs = []

    @classmethod
    def _from_ir(cls, ir, app_id, filepath):
        generator = cls(app_id)
        generator.ir = ir
        generator.filepath = filepath
        generator._stubs = [Stub(index) for index, _cell in enumerate(ir.cells)]
        return generator

    async def build(self):
        self.built = True

    def render_head(self):
        return (
            '<script type="module" src="/runtime.js"></script>'
            '<link href="/style.css" rel="stylesheet">'
            '<marimo-filename></marimo-filename>'
        )


def markdown_to_marimo(source):
    return f"mo.md({source!r})"


def sql_to_marimo(source, output_name, hide_output, engine):
    return f"{output_name} = sql({source!r}, hide_output={hide_output}, engine={engine!r})"


marimo = types.ModuleType("marimo")
marimo.__version__ = "0.0.test"
marimo.MarimoIslandGenerator = MarimoIslandGenerator
sys.modules["marimo"] = marimo

for name in [
    "marimo._convert",
    "marimo._convert.common",
    "marimo._schemas",
]:
    sys.modules[name] = types.ModuleType(name)

format_module = types.ModuleType("marimo._convert.common.format")
format_module.markdown_to_marimo = markdown_to_marimo
format_module.sql_to_marimo = sql_to_marimo
sys.modules["marimo._convert.common.format"] = format_module

serialization = types.ModuleType("marimo._schemas.serialization")
serialization.AppInstantiation = AppInstantiation
serialization.CellDef = CellDef
serialization.NotebookSerializationV1 = NotebookSerializationV1
sys.modules["marimo._schemas.serialization"] = serialization

spec = importlib.util.spec_from_file_location("extract_marimo_under_test", sys.argv[1])
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules[spec.name] = module
spec.loader.exec_module(module)

payload = json.loads(sys.stdin.read())
result = asyncio.run(module.extract(payload))
sys.stdout.write(json.dumps(result))
`;

describe("extract-marimo.py", () => {
  it("declares the Python runtime lower bound in script metadata", () => {
    const source = readFileSync(join("src", "extractor", "extract-marimo.py"), "utf8");

    expect(source).toContain('# requires-python = ">=3.10"');
  });

  it("extracts fixture payloads through staged Python helpers", () => {
    const result = spawnSync(
      process.env.PYTHON ?? "python3",
      ["-c", pythonHarness, join("src", "extractor", "extract-marimo.py")],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        input: JSON.stringify(fixtureRequest()),
      },
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const parsed = JSON.parse(result.stdout) as MarimoPageResult;
    expect(parsed.outputs).toHaveLength(2);
    expect(parsed.outputs[0]).toMatchObject({
      appId: "mdx-882921df4723",
      cellIndex: 0,
      runtimeCellCount: 2,
    });
    expect(parsed.outputs[0]?.assets?.moduleScripts).toEqual(["/runtime.js"]);
    expect(parsed.outputs[0]?.assets?.links).toEqual([{ href: "/style.css", rel: "stylesheet" }]);
    expect(parsed.outputs[0]?.assets?.version).toBe("0.0.test");
    expect(parsed.outputs[0]?.assets?.headTags).toEqual([
      { tag: "marimo-filename", attrs: {}, text: "fixtures/page.mdx" },
    ]);
    expect(parsed.outputs[0]?.assets?.exportContext).toMatchObject({
      trusted: true,
      notebookCode: expect.stringContaining('dependencies = ["wigglystuff"]'),
    });
    expect(parsed.outputs[0]?.assets?.exportContext?.notebookCode).toContain("# /// script");
    expect(parsed.outputs[0]?.assets?.exportContext?.notebookCode).toContain("import marimo");
    expect(parsed.outputs[0]?.assets?.exportContext?.notebookCode).toContain("x = 1");
    expect(parsed.outputs[0]?.html).toContain('"reactive": true');
    expect(parsed.outputs[0]?.html).toContain('"displayOutput": false');
    expect(parsed.outputs[1]?.html).toContain('<pre><code class="language-python">');
    expect(parsed.outputs[1]?.html).toContain("author source");
  });
});

function fixtureRequest(): MarimoPageRequest {
  return {
    filename: "fixtures/page.mdx",
    identity: "fixtures/page.mdx",
    metadata: {
      pyproject: 'requires-python = ">=3.11"\ndependencies = ["wigglystuff"]',
    },
    diagnostics: [],
    cells: [
      {
        index: 0,
        source: "x = 1",
        options: cellOptions({ output: true, source: false, enabled: true, serverOutput: false }),
      },
      {
        index: 1,
        source: "author source",
        options: cellOptions({ output: false, source: true, enabled: false }),
      },
    ],
  };
}

function cellOptions({
  enabled,
  output,
  serverOutput = true,
  source,
}: {
  enabled: boolean;
  output: boolean;
  serverOutput?: boolean;
  source: boolean;
}): MarimoCellOptions {
  return {
    language: "python",
    render: {
      source,
      output,
      include: true,
      editor: false,
      error: true,
      serverOutput,
    },
    execution: { enabled },
    marimo: { disabled: false, unparsable: !enabled },
  };
}
