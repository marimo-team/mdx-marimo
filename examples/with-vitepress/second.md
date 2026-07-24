---
title: Independent page
---

# Independent VitePress page

This page compiles into a separate marimo app and uses the compact
`python.marimo` fence form.

```python.marimo
import marimo as mo

exponent = mo.ui.slider(1, 8, value=3, label="Exponent")
exponent
```

```python.marimo echo=true
result = 2 ** exponent.value
mo.md(f"Two to the power of {exponent.value} is **{result}**.")
```

An ordinary Python fence stays a highlighted code block:

```python
print("VitePress owns this code block")
```

Return to the [shared page](./index.md).
