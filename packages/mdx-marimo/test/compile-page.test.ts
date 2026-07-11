import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  MARIMO_PAGE_PROTOCOL_VERSION,
  type CompiledMarimoPage,
  type MarimoCellOptions,
  type MarimoPageRequest,
} from "@marimo-team/islands-bridge/protocol";

const pythonHarness = String.raw`
import asyncio
from dataclasses import dataclass
import importlib.util
import json
import sys
import types

build_calls = []


@dataclass
class AppInstantiation:
    options: dict


@dataclass
class CellDef:
    code: str
    name: str
    options: dict


@dataclass
class UnparsableCell(CellDef):
    pass


@dataclass
class NotebookSerializationV1:
    app: AppInstantiation
    filename: str | None
    cells: list


class Stub:
    def __init__(self, index, reactive):
        self.index = index
        self.reactive = reactive

    def render(self, display_code=None, display_output=None, is_reactive=None):
        return json.dumps({
            "displayCode": display_code,
            "displayOutput": display_output,
            "index": self.index,
            "reactive": self.reactive if is_reactive is None else is_reactive,
        })


class MarimoIslandGenerator:
    last_ir = None

    def __init__(self, app_id):
        self.app_id = app_id
        self.has_run = False
        self._app = object()
        self._source_filename = None
        self._stubs = []

    @classmethod
    def _from_ir(cls, ir, app_id, filepath):
        cls.last_ir = ir
        generator = cls(app_id)
        generator.ir = ir
        generator.filepath = filepath
        generator._source_filename = filepath
        generator._stubs = [
            Stub(
                index,
                not isinstance(cell, UnparsableCell)
                and not cell.options.get("disabled", False),
            )
            for index, cell in enumerate(ir.cells)
        ]
        return generator

    @property
    def stubs(self):
        return tuple(self._stubs)

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


class AppFileManager:
    @classmethod
    def from_app(cls, app, filename=None):
        return {"app": app, "filename": filename}


async def run_app_until_completion(file_manager, cli_args, argv, persist_session):
    build_calls.append({
        "filename": file_manager["filename"],
        "cliArgs": cli_args,
        "argv": argv,
        "persistSession": persist_session,
    })
    return "session-view", False


marimo = types.ModuleType("marimo")
marimo.__version__ = "0.0.test"
marimo.MarimoIslandGenerator = MarimoIslandGenerator
sys.modules["marimo"] = marimo

for name in [
    "marimo._ast",
    "marimo._convert",
    "marimo._convert.common",
    "marimo._schemas",
    "marimo._server",
    "marimo._session",
]:
    sys.modules[name] = types.ModuleType(name)

def generate_filecontents_from_ir(ir):
    assert ir.filename is None
    return "import marimo\napp = marimo.App()\n" + "\n".join(
        cell.code for cell in ir.cells
    )


codegen_module = types.ModuleType("marimo._ast.codegen")
codegen_module.generate_filecontents_from_ir = generate_filecontents_from_ir
sys.modules["marimo._ast.codegen"] = codegen_module

format_module = types.ModuleType("marimo._convert.common.format")
format_module.markdown_to_marimo = markdown_to_marimo
format_module.sql_to_marimo = sql_to_marimo
sys.modules["marimo._convert.common.format"] = format_module

serialization = types.ModuleType("marimo._schemas.serialization")
serialization.AppInstantiation = AppInstantiation
serialization.CellDef = CellDef
serialization.NotebookSerializationV1 = NotebookSerializationV1
serialization.UnparsableCell = UnparsableCell
sys.modules["marimo._schemas.serialization"] = serialization

export_module = types.ModuleType("marimo._server.export")
export_module.run_app_until_completion = run_app_until_completion
sys.modules["marimo._server.export"] = export_module

notebook_module = types.ModuleType("marimo._session.notebook")
notebook_module.AppFileManager = AppFileManager
sys.modules["marimo._session.notebook"] = notebook_module

spec = importlib.util.spec_from_file_location("compile_marimo_page_under_test", sys.argv[1])
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules[spec.name] = module
spec.loader.exec_module(module)

payload = json.loads(sys.stdin.read())
result = asyncio.run(module.compile_page(payload))
result["buildCalls"] = build_calls
result["ir"] = [
    {
        "type": type(cell).__name__,
        "code": cell.code,
        "options": cell.options,
    }
    for cell in MarimoIslandGenerator.last_ir.cells
]
sys.stdout.write(json.dumps(result))
`;

describe("compile-page.py", () => {
  it("declares the Python runtime lower bound in script metadata", () => {
    const source = readFileSync(join("src", "node", "compile-page.py"), "utf8");

    expect(source).toContain('# requires-python = ">=3.11"');
  });

  it("compiles fixture payloads into one page-level app", () => {
    const result = spawnSync(
      process.env.PYTHON ?? "python3",
      ["-c", pythonHarness, join("src", "node", "compile-page.py")],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        input: JSON.stringify(fixtureRequest()),
      },
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const parsed = JSON.parse(result.stdout) as CompiledMarimoPage;
    expect(parsed.protocolVersion).toBe(MARIMO_PAGE_PROTOCOL_VERSION);
    expect(parsed.cells).toHaveLength(3);
    expect(parsed.app).toMatchObject({
      id: "marimo-882921df4723",
      runtimeCellCount: 4,
    });
    expect(parsed.app?.assets.moduleScripts).toEqual(["/runtime.js"]);
    expect(parsed.app?.assets.links).toEqual([{ href: "/style.css", rel: "stylesheet" }]);
    expect(parsed.app?.assets.version).toBe("0.0.test");
    expect(parsed.app?.assets.headTags).toEqual([
      { tag: "marimo-filename", attrs: {}, text: "fixtures/page.mdx" },
    ]);
    expect(parsed.app?.notebookCode).toContain('dependencies = ["wigglystuff"]');
    expect(parsed.app?.notebookCode).toContain("# /// script");
    expect(parsed.app?.notebookCode).toContain("import math");
    expect(parsed.app?.notebookCode).toContain("x = 1");
    expect(parsed.cells[0]?.html).toContain('"reactive": true');
    expect(parsed.cells[0]?.html).toContain('"displayOutput": false');
    expect(parsed.cells[1]?.html).toContain('<pre><code class="language-python">');
    expect(parsed.cells[1]?.html).toContain("disabled source");
    expect(parsed.cells[1]?.html).toContain('"reactive": false');
    expect(parsed.cells[2]?.html).toContain("unparsable source");
    expect((JSON.parse(result.stdout) as { ir: unknown }).ir).toEqual([
      { type: "CellDef", code: "import math", options: {} },
      { type: "CellDef", code: "x = 1", options: {} },
      { type: "CellDef", code: "disabled source", options: { disabled: true } },
      {
        type: "UnparsableCell",
        code: "unparsable source",
        options: { disabled: true },
      },
    ]);
    expect(JSON.parse(result.stdout).buildCalls).toEqual([
      {
        filename: "fixtures/page.mdx",
        cliArgs: {},
        argv: null,
        persistSession: false,
      },
    ]);
  });
});

function fixtureRequest(): MarimoPageRequest {
  return {
    protocolVersion: MARIMO_PAGE_PROTOCOL_VERSION,
    filename: "fixtures/page.mdx",
    identity: "fixtures/page.mdx",
    metadata: {
      pyproject: 'requires-python = ">=3.10"\ndependencies = ["wigglystuff"]',
      setupCells: [
        {
          index: -1,
          source: "import math",
          options: { language: "python" },
        },
      ],
    },
    cells: [
      {
        index: 0,
        source: "x = 1",
        options: cellOptions({ output: true, source: false, enabled: true, serverOutput: false }),
      },
      {
        index: 1,
        source: "disabled source",
        options: cellOptions({
          output: true,
          source: true,
          enabled: false,
          disabled: true,
        }),
      },
      {
        index: 2,
        source: "unparsable source",
        options: cellOptions({
          output: false,
          source: true,
          enabled: false,
          unparsable: true,
        }),
      },
    ],
  };
}

function cellOptions({
  enabled,
  disabled = false,
  output,
  serverOutput = true,
  source,
  unparsable = false,
}: {
  enabled: boolean;
  disabled?: boolean;
  output: boolean;
  serverOutput?: boolean;
  source: boolean;
  unparsable?: boolean;
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
    marimo: { disabled, unparsable },
  };
}
