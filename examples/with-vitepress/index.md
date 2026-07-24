---
title: Shared reactive page
---

```marimo-config
requires-python = ">=3.12"
dependencies = ["wigglystuff"]
```

# VitePress marimo

The controls and both outputs belong to one page-scoped marimo app. VitePress
keeps the prose, navigation, and surrounding layout.

```python marimo output=false
import marimo as mo
from wigglystuff import Slider2D
```

```python marimo
count = mo.ui.slider(1, 8, value=3, label="Count")
step = mo.ui.slider(1, 5, value=2, label="Step")
mo.hstack([count, step])
```

This paragraph is ordinary VitePress Markdown between dependent cells.

```python marimo
values = [step.value * index for index in range(1, count.value + 1)]
mo.md("Generated values: **" + ", ".join(str(value) for value in values) + "**")
```

> ## Reactive summary
>
> The nested fence checks that VitePress keeps the island inside its blockquote.
>
> ```python.marimo
> total = sum(values)
> mo.md(f"The current total is **{total}**.")
> ```

## Configured Python package

The page config adds `wigglystuff` to the compiler and browser environment.
`Slider2D` exposes its synchronized coordinates to the next cell.

```python marimo
point = mo.ui.anywidget(
    Slider2D(
        x=0.25,
        y=0.75,
        width=280,
        height=220,
        x_bounds=(0.0, 1.0),
        y_bounds=(0.0, 1.0),
    )
)
point
```

```python marimo
mo.md(f"Selected point: **x={point.x:.2f}, y={point.y:.2f}**")
```

Open the [second page](./second.md) to create a separate app, then return here
to exercise VitePress client navigation.
