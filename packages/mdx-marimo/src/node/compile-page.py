# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "marimo>=0.23.13",
# ]
# ///
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from html.parser import HTMLParser
import hashlib
import json
import keyword
import sys
from typing import Any
from urllib.parse import quote

import marimo
from marimo import MarimoIslandGenerator
from marimo._ast.codegen import generate_filecontents_from_ir
from marimo._convert.common.format import markdown_to_marimo, sql_to_marimo
from marimo._schemas.serialization import (
    AppInstantiation,
    CellDef,
    NotebookSerializationV1,
    UnparsableCell,
)

PAGE_PROTOCOL_VERSION = 2
DEFAULT_CELL_OPTIONS: dict[str, Any] = {
    "language": "python",
    "render": {
        "source": False,
        "output": True,
        "include": True,
        "editor": False,
        "error": True,
        "serverOutput": True,
    },
    "execution": {"enabled": True},
    "marimo": {"disabled": False, "unparsable": False},
}


class HeadAssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.module_scripts: list[str] = []
        self.links: list[dict[str, str]] = []
        self.head_tags: list[dict[str, Any]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key: value or "" for key, value in attrs}
        if tag == "script" and values.get("type") == "module" and values.get("src"):
            self.module_scripts.append(values["src"])
        elif tag == "link" and values.get("href"):
            self.links.append(values)
        elif tag != "script":
            self.head_tags.append({"tag": tag, "attrs": values})


@dataclass
class PlannedCell:
    index: int
    code: str
    options: dict[str, Any]
    executable_source: str
    execute: bool
    display_code: bool
    display_editor: bool
    display_output: bool
    display_server_output: bool


@dataclass
class PageRequest:
    identity: str
    filename: str
    app_id: str
    pyproject: str | None
    setup_cells: list[PlannedCell]
    cells: list[PlannedCell]

    @property
    def runtime_cells(self) -> list[PlannedCell]:
        return [*self.setup_cells, *self.cells]


def as_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() == "true"
    return bool(value)


def is_valid_identifier(name: str) -> bool:
    return name.isidentifier() and not keyword.iskeyword(name)


def sql_target(output_name: Any) -> str:
    target = str(output_name or "_df")
    return target if is_valid_identifier(target) and target != "mo" else "_df"


def executable_source(cell: dict[str, Any], options: dict[str, Any]) -> str:
    code = str(cell.get("source") or "")
    language = str(options.get("language") or "python").lower()
    if language == "sql":
        sql = options.get("sql") if isinstance(options.get("sql"), dict) else {}
        render = options.get("render") if isinstance(options.get("render"), dict) else {}
        return sql_to_marimo(
            code,
            sql_target(sql.get("outputName")),
            not as_bool(render.get("output"), True),
            str(sql["engine"]) if sql.get("engine") else None,
        )
    if language == "markdown":
        return markdown_to_marimo(code)
    return code


def merge_cell_options(
    defaults: dict[str, Any], cell_options: dict[str, Any]
) -> dict[str, Any]:
    options = dict(DEFAULT_CELL_OPTIONS)
    options.update(defaults)
    options.update(cell_options)
    for section in ("render", "execution", "marimo", "sql"):
        merged: dict[str, Any] = {}
        for source in (DEFAULT_CELL_OPTIONS, defaults, cell_options):
            value = source.get(section)
            if isinstance(value, dict):
                merged.update(value)
        if merged:
            options[section] = merged
    return options


def plan_cell(
    cell: dict[str, Any], defaults: dict[str, Any], *, setup: bool = False
) -> PlannedCell:
    cell_options = (
        dict(cell.get("options")) if isinstance(cell.get("options"), dict) else {}
    )
    options = merge_cell_options(defaults, cell_options)
    render = options.get("render") if isinstance(options.get("render"), dict) else {}
    execution = (
        options.get("execution") if isinstance(options.get("execution"), dict) else {}
    )
    marimo_options = (
        options.get("marimo") if isinstance(options.get("marimo"), dict) else {}
    )
    include = False if setup else as_bool(render.get("include"), True)
    execute = (
        as_bool(execution.get("enabled"), True)
        and not as_bool(marimo_options.get("disabled"))
        and not as_bool(marimo_options.get("unparsable"))
    )
    display_code = False if setup else as_bool(render.get("source"), False)
    display_editor = False if setup else as_bool(render.get("editor"), False)
    display_output = include and as_bool(render.get("output"), True)
    display_server_output = display_output and as_bool(render.get("serverOutput"), True)
    return PlannedCell(
        index=int(cell.get("index") or 0),
        code=str(cell.get("source") or ""),
        options=options,
        executable_source=executable_source(cell, options),
        execute=execute,
        display_code=display_code,
        display_editor=display_editor,
        display_output=display_output,
        display_server_output=display_server_output,
    )


def page_request(payload: dict[str, Any]) -> PageRequest:
    protocol_version = payload.get("protocolVersion")
    if protocol_version != PAGE_PROTOCOL_VERSION:
        raise ValueError(f"unsupported marimo page protocol: {protocol_version}")
    identity = str(payload.get("identity") or payload.get("filename") or "document.mdx")
    filename = str(payload.get("filename") or "")
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    pyproject = metadata.get("pyproject") if isinstance(metadata.get("pyproject"), str) else None
    defaults = payload.get("defaults") if isinstance(payload.get("defaults"), dict) else {}
    setup_cells = (
        metadata.get("setupCells") if isinstance(metadata.get("setupCells"), list) else []
    )
    return PageRequest(
        identity=identity,
        filename=filename,
        app_id="marimo-" + page_digest(identity),
        pyproject=pyproject,
        setup_cells=[
            plan_cell(cell, defaults, setup=True)
            for cell in setup_cells
            if isinstance(cell, dict)
        ],
        cells=[
            plan_cell(cell, defaults)
            for cell in payload.get("cells") or []
            if isinstance(cell, dict)
        ],
    )


def page_digest(identity: str) -> str:
    return hashlib.sha1(identity.encode("utf-8")).hexdigest()[:12]


def assets_from_head(head: str, filename: str = "") -> dict[str, Any]:
    parser = HeadAssetParser()
    parser.feed(head)
    if filename:
        for tag in parser.head_tags:
            if tag.get("tag") == "marimo-filename":
                tag["text"] = quote(filename)
    return {
        "moduleScripts": parser.module_scripts,
        "links": parser.links,
        "headTags": parser.head_tags,
    }


def renders_author_source(plan: PlannedCell) -> bool:
    language = str(plan.options.get("language") or "python").lower()
    return plan.display_code and (language != "python" or not plan.display_editor)


def cell_name(plan: PlannedCell) -> str:
    name = plan.options.get("name")
    return str(name) if isinstance(name, str) and is_valid_identifier(name) else "_"


def cell_config(plan: PlannedCell) -> dict[str, Any]:
    config: dict[str, Any] = {}
    column = plan.options.get("column")
    if isinstance(column, int):
        config["column"] = column
    if not plan.execute:
        config["disabled"] = True
    return config


def ir_cell(plan: PlannedCell) -> CellDef:
    marimo_options = (
        plan.options.get("marimo")
        if isinstance(plan.options.get("marimo"), dict)
        else {}
    )
    cell_type = (
        UnparsableCell
        if as_bool(marimo_options.get("unparsable"))
        else CellDef
    )
    code = plan.code if cell_type is UnparsableCell else plan.executable_source
    return cell_type(
        code=code,
        name=cell_name(plan),
        options=cell_config(plan),
    )


def to_marimo_ir(request: PageRequest) -> NotebookSerializationV1:
    # The host path remains on PageRequest. An MDX filename is not a valid
    # marimo notebook filename and would make Python code generation fail.
    return NotebookSerializationV1(
        app=AppInstantiation(options={}),
        filename=None,
        cells=[ir_cell(plan) for plan in request.runtime_cells],
    )


def generator_from_ir(
    notebook: NotebookSerializationV1, request: PageRequest
) -> MarimoIslandGenerator:
    if notebook.cells:
        return MarimoIslandGenerator._from_ir(
            notebook,
            app_id=request.app_id,
            filepath=request.filename or None,
        )
    return MarimoIslandGenerator(app_id=request.app_id)


async def build_generator(generator: MarimoIslandGenerator) -> None:
    from marimo._server.export import run_app_until_completion
    from marimo._session.notebook import AppFileManager

    if getattr(generator, "has_run", False):
        raise ValueError("marimo island generator has already been built")

    # Host builds should not create marimo session files beside MDX sources.
    session, _did_error = await run_app_until_completion(
        file_manager=AppFileManager.from_app(
            getattr(generator, "_app"),
            filename=getattr(generator, "_source_filename", None),
        ),
        cli_args={},
        argv=None,
        persist_session=False,
    )
    generator.has_run = True

    for stub in generator.stubs:
        stub._internal_app = getattr(generator, "_app")
        stub._session_view = session


def stubs_from_generator(
    generator: MarimoIslandGenerator, plans: list[PlannedCell]
) -> list[Any]:
    generated_stubs = list(generator.stubs)
    if len(generated_stubs) != len(plans):
        raise RuntimeError("marimo IR compilation produced an unexpected island stub count")
    return generated_stubs


def assets_from_generator(
    generator: MarimoIslandGenerator,
    request: PageRequest,
    notebook: NotebookSerializationV1,
) -> dict[str, Any]:
    assets = assets_from_head(generator.render_head(), request.filename)
    version = getattr(marimo, "__version__", None)
    if isinstance(version, str) and version:
        assets["version"] = version
    return assets


def browser_notebook_code(
    notebook: NotebookSerializationV1, pyproject: str | None
) -> str:
    parts: list[str] = []
    metadata = inline_script_metadata(pyproject)
    if metadata:
        parts.append(metadata)
    parts.append(generate_filecontents_from_ir(notebook).strip())
    return "\n".join(parts)


def inline_script_metadata(pyproject: str | None) -> str:
    if not pyproject or not pyproject.strip():
        return ""
    lines = ["# /// script"]
    for line in pyproject.strip().splitlines():
        lines.append(f"# {line}" if line else "#")
    lines.append("# ///")
    return "\n".join(lines)


def author_source_html(plan: PlannedCell) -> str:
    language = str(plan.options.get("language") or "python").lower()
    return (
        f'<pre><code class="language-{escape_html(language)}">'
        f"{escape_html(plan.code)}</code></pre>"
    )


def outputs_from_stubs(
    plans: list[PlannedCell],
    stubs: list[Any],
) -> list[dict[str, Any]]:
    outputs = []
    for plan, stub in zip(plans, stubs, strict=True):
        if renders_author_source(plan):
            parts = [author_source_html(plan)]
            if plan.display_output or plan.execute:
                parts.append(
                    render_stub(
                        stub,
                        display_code=False,
                        display_output=plan.display_server_output,
                    )
                )
            html = "\n".join(part for part in parts if part)
        else:
            html = render_stub(
                stub,
                display_code=plan.display_editor,
                display_output=plan.display_server_output,
            )
        outputs.append(
            {
                "html": html,
                "index": plan.index,
                "options": plan.options,
            }
        )
    return outputs


def render_stub(stub: Any, *, display_code: bool, display_output: bool) -> str:
    try:
        return stub.render(
            display_code=display_code,
            display_output=display_output,
        )
    except ValueError:
        if not display_code and not display_output:
            return ""
        raise


async def compile_page(payload: dict[str, Any]) -> dict[str, Any]:
    request = page_request(payload)
    notebook = to_marimo_ir(request)
    generator = generator_from_ir(notebook, request)
    runtime_cells = request.runtime_cells
    stubs = stubs_from_generator(generator, runtime_cells)

    if stubs:
        await build_generator(generator)

    assets = assets_from_generator(generator, request, notebook)
    authored_stubs = stubs[len(request.setup_cells) :]
    return {
        "protocolVersion": PAGE_PROTOCOL_VERSION,
        "app": {
            "id": request.app_id,
            "runtimeCellCount": len(runtime_cells),
            "assets": assets,
            "notebookCode": browser_notebook_code(notebook, request.pyproject),
        }
        if runtime_cells
        else None,
        "cells": outputs_from_stubs(request.cells, authored_stubs),
        "diagnostics": [],
    }


def escape_html(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def main() -> None:
    payload = json.loads(sys.stdin.read())
    result = asyncio.run(compile_page(payload))
    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()
