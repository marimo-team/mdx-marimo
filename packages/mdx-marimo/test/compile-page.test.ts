import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  MARIMO_PAGE_PROTOCOL_VERSION,
  isCompiledMarimoPage,
  type CompiledMarimoPage,
  type MarimoCellOptions,
  type MarimoPageRequest,
} from "@marimo-team/mdx-marimo/bridge/protocol";

const pythonHarness = String.raw`
import asyncio
from dataclasses import dataclass
import importlib.util
import json
import sys
import tomllib
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


@dataclass
class Output:
    mimetype: str
    data: object

    def asdict(self):
        return {"mimetype": self.mimetype, "data": self.data}


class Stub:
    def __init__(self, index, reactive, has_error):
        self.index = index
        self.reactive = reactive
        self.has_error = has_error
        self.output = (
            Output("application/vnd.marimo+error", "ValueError")
            if has_error
            else Output("text/plain", "compiled output")
            if reactive
            else None
        )

    def render(
        self,
        display_code=None,
        display_output=None,
        is_reactive=None,
        as_raw=False,
    ):
        if as_raw:
            return f"<p>{self.output.data}</p>" if self.output is not None else ""
        return json.dumps({
            "displayCode": display_code,
            "displayOutput": display_output,
            "index": self.index,
            "reactive": self.reactive if is_reactive is None else is_reactive,
        })


class MarimoIslandGenerator:
    def __init__(self, app_id):
        self.app_id = app_id
        self.has_run = False
        self._app = object()
        self._source_filename = None
        self._stubs = []

    @classmethod
    def _from_ir(cls, ir, app_id, filepath):
        generator = cls(app_id)
        generator.ir = ir
        generator.filepath = filepath
        generator._source_filename = filepath
        generator._stubs = [
            Stub(
                index,
                not isinstance(cell, UnparsableCell)
                and not cell.options.get("disabled", False),
                "raise ValueError" in cell.code,
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
    output_arg = ", output=False" if hide_output else ""
    engine_arg = f", engine={engine}" if engine else ""
    return f"{output_name} = mo.sql(f{source!r}{output_arg}{engine_arg})"


class AppFileManager:
    @classmethod
    def from_app(cls, app, filename=None):
        return {"app": app, "filename": filename}


@dataclass
class NotebookExecutionOptions:
    cli_args: dict
    argv: list | None
    quiet: bool = False
    persist_session: bool = True


@dataclass
class RunNotebookRequest:
    file_manager: object
    options: NotebookExecutionOptions


async def run_app_until_completion(file_manager, cli_args, argv, quiet, persist_session):
    build_calls.append({
        "filename": file_manager["filename"],
        "cliArgs": cli_args,
        "argv": argv,
        "quiet": quiet,
        "persistSession": persist_session,
    })
    return "session-view", False


async def run_notebook(request):
    build_calls.append({
        "filename": request.file_manager["filename"],
        "cliArgs": request.options.cli_args,
        "argv": request.options.argv,
        "quiet": request.options.quiet,
        "persistSession": request.options.persist_session,
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
    "marimo._utils",
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

def read_pyproject_from_script(script):
    lines = script.strip().splitlines()
    content = "\n".join(
        line[2:] if line.startswith("# ") else line[1:]
        for line in lines[1:-1]
    )
    return tomllib.loads(content)

scripts_module = types.ModuleType("marimo._utils.scripts")
scripts_module.read_pyproject_from_script = read_pyproject_from_script
sys.modules["marimo._utils.scripts"] = scripts_module

export_api = sys.argv[2]
if export_api == "current":
    sys.modules["marimo._export"] = types.ModuleType("marimo._export")
    sys.modules["marimo._export.file"] = types.ModuleType("marimo._export.file")
    sys.modules["marimo._export.file"].run_notebook = run_notebook
    sys.modules["marimo._export.requests"] = types.ModuleType("marimo._export.requests")
    sys.modules["marimo._export.requests"].NotebookExecutionOptions = NotebookExecutionOptions
    sys.modules["marimo._export.requests"].RunNotebookRequest = RunNotebookRequest
else:
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
sys.stdout.write(json.dumps(result))
`;

const compilerPath = join("..", "islands-compiler", "compiler.py");

describe("islands compiler", () => {
  it("declares the Python runtime lower bound in script metadata", () => {
    const source = readFileSync(compilerPath, "utf8");

    expect(source).toContain('# requires-python = ">=3.11"');
    expect(source).toContain('"marimo>=0.23.15"');
  });

  it("compiles fixture payloads into one page-level app", () => {
    const parsed = compilePage(fixtureRequest());

    expect(parsed.protocolVersion).toBe(MARIMO_PAGE_PROTOCOL_VERSION);
    expect(parsed.cells).toHaveLength(3);
    expect(parsed.app).toMatchObject({
      runtimeCellCount: 4,
    });
    expect(parsed.app?.notebookCode).toContain('dependencies = ["wigglystuff"]');
    expect(parsed.app?.notebookCode).toContain("import math");
    expect(parsed.cells[0]?.output?.mimetype).toBe("text/plain");
    expect(parsed.cells[0]?.output?.data).toBe("compiled output");
    expect(parsed.cells[1]?.html).toContain("disabled source");
    expect(parsed.cells[1]?.output).toBeNull();
    expect(parsed.cells[1]?.options.execution.enabled).toBe(false);
    expect(parsed.cells[2]?.html).toContain("unparsable source");
    expect(parsed.cells[2]?.options.execution.enabled).toBe(false);
  });

  it.each([
    ["request API", "current"],
    ["legacy export package", "legacy"],
  ] as const)("executes through the %s", (_, exportApi) => {
    const result = compileRequest(fixtureRequest(), exportApi);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).buildCalls).toEqual([
      {
        filename: "fixtures/page.mdx",
        cliArgs: {},
        argv: null,
        quiet: true,
        persistSession: false,
      },
    ]);
  });

  it("uses source startup for wrapped PEP 723 dependencies", () => {
    const request = fixtureRequest();
    request.metadata = {
      pyproject: '# /// script\n# "dependencies" = ["wigglystuff"]\n# ///',
    };

    const parsed = compilePage(request);

    expect(parsed.app?.notebookCode).toContain('# "dependencies" = ["wigglystuff"]');
  });

  it("imports marimo for converted setup cells", () => {
    const request = fixtureRequest();
    request.metadata = {
      setupCells: [
        {
          index: -1,
          source: "Setup",
          options: { language: "markdown" },
        },
      ],
    };

    const code = compilePage(request).app?.notebookCode ?? "";

    expect(code).toContain("import marimo as mo");
    expect(code).toContain("mo.md('Setup')");
  });

  it("preserves authored SQL references when the marimo alias is private", () => {
    const request = fixtureRequest();
    request.metadata = {};
    request.cells = [
      {
        index: 0,
        source: "mo = 7",
        options: { language: "python" },
      },
      {
        index: 1,
        source: "SELECT {mo} AS value, {mo.sql()} AS nested",
        options: {
          language: "sql",
          render: { output: false },
          sql: { engine: "mo", outputName: "result" },
        },
      },
    ];

    const code = compilePage(request).app?.notebookCode ?? "";

    expect(code).toContain("_mo.sql");
    expect(code).toContain("SELECT {mo}");
    expect(code).toContain("{mo.sql()}");
    expect(code).toContain("output=False");
    expect(code).toContain("engine=mo");
  });

  it("reports cells disabled by page defaults as non-executable", () => {
    const request = fixtureRequest();
    request.metadata = {};
    request.defaults = { marimo: { disabled: true } };
    request.cells = [
      {
        index: 0,
        source: "value = 1",
        options: {
          language: "python",
        },
      },
    ];

    const parsed = compilePage(request);

    expect(parsed.cells[0]?.options.execution.enabled).toBe(false);
  });

  it("reports editor source visibility in effective options", () => {
    const request = fixtureRequest();
    request.metadata = {};
    request.cells = [
      {
        index: 0,
        source: "value = 1",
        options: { language: "python", render: { editor: true } },
      },
    ];

    const parsed = compilePage(request);

    expect(parsed.cells[0]?.options.render.source).toBe(true);
    expect(parsed.cells[0]?.options.render.editor).toBe(true);
  });

  it("renders default-unparsable source unless the cell hides it", () => {
    const request = fixtureRequest();
    request.metadata = {};
    request.defaults = { marimo: { unparsable: true } };
    request.cells = [
      {
        index: 0,
        source: "unparsable source",
        options: { language: "python" },
      },
      {
        index: 1,
        source: "hidden unparsable source",
        options: { language: "python", render: { source: false } },
      },
    ];

    const parsed = compilePage(request);

    expect(parsed.cells[0]?.options.execution.enabled).toBe(false);
    expect(parsed.cells[0]?.options.render.source).toBe(true);
    expect(parsed.cells[0]?.html).toContain("unparsable source");
    expect(parsed.cells[1]?.options.execution.enabled).toBe(false);
    expect(parsed.cells[1]?.options.render.source).toBe(false);
  });

  it("rejects failed cells when error rendering is disabled", () => {
    const request = fixtureRequest();
    request.metadata = {};
    request.cells = [
      {
        index: 0,
        source: "raise ValueError('broken')",
        startLine: 12,
        options: cellOptions({
          output: true,
          source: false,
          enabled: true,
          error: false,
        }),
      },
    ];
    const result = compileRequest(request);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("marimo execution failed in fixtures/page.mdx:12");
  });
});

function compileRequest(request: MarimoPageRequest, exportApi: "current" | "legacy" = "current") {
  return spawnSync(
    process.env.PYTHON ?? "python3",
    ["-c", pythonHarness, compilerPath, exportApi],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      input: JSON.stringify(request),
    },
  );
}

function compilePage(request: MarimoPageRequest): CompiledMarimoPage {
  const result = compileRequest(request);
  if (result.status !== 0) {
    throw new Error(result.stderr || "islands compiler failed");
  }
  const page: unknown = JSON.parse(result.stdout);
  if (!isCompiledMarimoPage(page)) {
    throw new Error("islands compiler returned an invalid page");
  }
  return page;
}

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
  error = true,
  output,
  serverOutput = true,
  source,
  unparsable = false,
}: {
  enabled: boolean;
  disabled?: boolean;
  error?: boolean;
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
      error,
      serverOutput,
    },
    execution: { enabled },
    marimo: { disabled, unparsable },
  };
}
