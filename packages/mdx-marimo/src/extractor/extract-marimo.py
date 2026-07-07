# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "marimo>=0.23.13",
#   "tomli>=2; python_version < '3.11'",
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
from marimo._convert.common.format import markdown_to_marimo, sql_to_marimo
from marimo._schemas.serialization import (
    AppInstantiation,
    CellDef,
    NotebookSerializationV1,
)


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
    display_output: bool
    display_server_output: bool
    include: bool


@dataclass
class PayloadContext:
    identity: str
    filename: str
    app_id: str


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


def plan_cell(cell: dict[str, Any]) -> PlannedCell:
    options = dict(cell.get("options") or {})
    render = options.get("render") if isinstance(options.get("render"), dict) else {}
    execution = (
        options.get("execution") if isinstance(options.get("execution"), dict) else {}
    )
    include = as_bool(render.get("include"), True)
    execute = as_bool(execution.get("enabled"), True)
    display_code = as_bool(render.get("source"), False)
    display_output = as_bool(render.get("output"), include)
    display_server_output = display_output and as_bool(render.get("serverOutput"), True)
    return PlannedCell(
        index=int(cell.get("index") or 0),
        code=str(cell.get("source") or ""),
        options=options,
        executable_source=executable_source(cell, options),
        execute=execute,
        display_code=display_code,
        display_output=display_output,
        display_server_output=display_server_output,
        include=include,
    )


def payload_context(payload: dict[str, Any]) -> PayloadContext:
    identity = str(payload.get("identity") or payload.get("filename") or "document.mdx")
    filename = str(payload.get("filename") or "")
    return PayloadContext(identity=identity, filename=filename, app_id="mdx-" + page_digest(identity))


def plans_from_payload(payload: dict[str, Any]) -> list[PlannedCell]:
    return [plan_cell(cell) for cell in payload.get("cells") or []]


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
    return plan.display_code and language != "python"


def cell_name(plan: PlannedCell) -> str:
    name = plan.options.get("name")
    return str(name) if isinstance(name, str) and is_valid_identifier(name) else "_"


def cell_config(plan: PlannedCell) -> dict[str, Any]:
    config: dict[str, Any] = {}
    column = plan.options.get("column")
    if isinstance(column, int):
        config["column"] = column
    return config


def notebook_ir(plans: list[PlannedCell], filename: str) -> NotebookSerializationV1:
    return NotebookSerializationV1(
        app=AppInstantiation(options={}),
        filename=filename or None,
        cells=[
            CellDef(
                code=plan.executable_source,
                name=cell_name(plan),
                options=cell_config(plan),
            )
            for plan in plans
            if plan.execute
        ],
    )


def generator_from_plans(
    plans: list[PlannedCell], context: PayloadContext
) -> MarimoIslandGenerator:
    if any(plan.execute for plan in plans):
        return MarimoIslandGenerator._from_ir(
            notebook_ir(plans, context.filename),
            app_id=context.app_id,
            filepath=context.filename or None,
        )
    return MarimoIslandGenerator(app_id=context.app_id)


def stubs_from_generator(
    generator: MarimoIslandGenerator, plans: list[PlannedCell]
) -> list[Any | None]:
    generated_stubs = list(getattr(generator, "_stubs", []))
    if len(generated_stubs) != sum(1 for plan in plans if plan.execute):
        raise RuntimeError("marimo IR extraction produced an unexpected island stub count")
    stub_iter = iter(generated_stubs)
    return [next(stub_iter) if plan.execute else None for plan in plans]


def assets_from_generator(
    generator: MarimoIslandGenerator,
    filename: str,
    plans: list[PlannedCell],
    pyproject: str | None,
) -> dict[str, Any]:
    assets = assets_from_head(generator.render_head(), filename)
    assets["exportContext"] = {
        "trusted": True,
        "notebookCode": browser_notebook_code(plans, pyproject),
    }
    version = getattr(marimo, "__version__", None)
    if isinstance(version, str) and version:
        assets["version"] = version
    return assets


def browser_notebook_code(plans: list[PlannedCell], pyproject: str | None) -> str:
    parts = []
    metadata = inline_script_metadata(pyproject)
    if metadata:
        parts.append(metadata)
    parts.extend(["import marimo", "app = marimo.App()"])
    for plan in plans:
        if not plan.execute:
            continue
        parts.append("@app.cell")
        parts.append(f"{'async def' if 'await ' in plan.executable_source else 'def'} __():")
        parts.extend(indented_cell_source(plan.executable_source))
        parts.append("    return")
    return "\n".join(parts)


def inline_script_metadata(pyproject: str | None) -> str:
    if not pyproject or not pyproject.strip():
        return ""
    lines = ["# /// script"]
    for line in pyproject.strip().splitlines():
        lines.append(f"# {line}" if line else "#")
    lines.append("# ///")
    return "\n".join(lines)


def indented_cell_source(source: str) -> list[str]:
    if not source.strip():
        return ["    pass"]
    return [f"    {line}" if line else "" for line in source.splitlines()]


def author_source_html(plan: PlannedCell) -> str:
    language = str(plan.options.get("language") or "python").lower()
    return (
        f'<pre><code class="language-{escape_html(language)}">'
        f"{escape_html(plan.code)}</code></pre>"
    )


def outputs_from_stubs(
    plans: list[PlannedCell],
    stubs: list[Any | None],
    assets: dict[str, Any],
    app_id: str,
) -> list[dict[str, Any]]:
    outputs = []
    for plan, stub in zip(plans, stubs, strict=True):
        if stub is None:
            html = (
                f'<pre><code class="language-{plan.options.get("language", "python")}">'
                f"{escape_html(plan.code)}</code></pre>"
                if plan.display_code
                else ""
            )
        else:
            if renders_author_source(plan):
                parts = [author_source_html(plan)]
                if plan.display_output or plan.execute:
                    parts.append(
                        stub.render(
                            display_code=False,
                            display_output=plan.display_server_output,
                            is_reactive=True,
                        )
                    )
                html = "\n".join(part for part in parts if part)
            else:
                html = stub.render(
                    display_code=plan.display_code,
                    display_output=plan.display_server_output,
                    is_reactive=True,
                )
        outputs.append(
            {
                "html": html,
                "appId": app_id,
                "assets": assets,
                "cellIndex": plan.index,
                "runtimeCellCount": len(plans),
                "options": plan.options,
            }
        )
    return outputs


async def extract(payload: dict[str, Any]) -> dict[str, Any]:
    context = payload_context(payload)
    plans = plans_from_payload(payload)
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    pyproject = metadata.get("pyproject") if isinstance(metadata.get("pyproject"), str) else None
    generator = generator_from_plans(plans, context)
    stubs = stubs_from_generator(generator, plans)

    if any(stub is not None for stub in stubs):
        await generator.build()

    assets = assets_from_generator(generator, context.filename, plans, pyproject)
    return {"outputs": outputs_from_stubs(plans, stubs, assets, context.app_id)}


def escape_html(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def main() -> None:
    payload = json.loads(sys.stdin.read())
    result = asyncio.run(extract(payload))
    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()
