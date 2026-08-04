# Islands compiler

`compiler.py` accepts one page protocol request on standard input and writes one
compiled page protocol record on standard output.

The compiler owns marimo cell planning, language conversion, build-time
evaluation, compiled cell metadata, and runtime asset extraction. Publishing
adapters own source collection, environment selection, and host projection.

MDX packages this source with `@marimo-team/mdx-marimo`. Python publishing
adapters vendor the file unchanged into their distributions.

Every request represents one complete publishing page. Setup cells and authored
cells are compiled into one marimo app so reactive dependencies, runtime assets,
and browser lifecycle have one page-level owner.
