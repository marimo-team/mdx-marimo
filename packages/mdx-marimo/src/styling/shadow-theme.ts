export const SHADOW_THEME_STYLE_ID = "mdx-marimo-shadow-theme";

export const SHADOW_THEME_CSS = `
:host {
  color-scheme: inherit;
  --background: var(--marimo-island-background, Canvas);
  --foreground: var(--marimo-island-foreground, CanvasText);
  --card: var(--marimo-island-surface, Field);
  --card-foreground: var(--foreground);
  --popover: var(--marimo-island-surface, Field);
  --popover-foreground: var(--foreground);
  --primary: var(--marimo-island-accent, Highlight);
  --primary-foreground: var(--marimo-island-accent-foreground, HighlightText);
  --secondary: var(
    --marimo-island-muted-surface,
    color-mix(in srgb, var(--foreground) 6%, var(--background))
  );
  --secondary-foreground: var(--foreground);
  --muted: var(
    --marimo-island-muted-surface,
    color-mix(in srgb, var(--foreground) 6%, var(--background))
  );
  --muted-foreground: var(
    --marimo-island-muted-foreground,
    color-mix(in srgb, var(--foreground) 68%, transparent)
  );
  --accent: var(--marimo-island-accent, Highlight);
  --accent-foreground: var(--marimo-island-accent-foreground, HighlightText);
  --border: var(--marimo-island-border, ButtonBorder);
  --input: var(--marimo-island-border, ButtonBorder);
  --ring: var(--marimo-island-focus-ring, var(--primary));
  --cm-background: var(--marimo-island-code-background, var(--background));
  --cm-foreground: var(--marimo-island-code-foreground, var(--foreground));
  --cm-comment: var(--marimo-island-muted-foreground, var(--muted-foreground));
  --radius: var(--marimo-island-radius, 0.5rem);
  --_mdxm-shadow-hover-background: color-mix(in srgb, var(--foreground) 8%, transparent);
  --_mdxm-shadow-error-background: var(
    --marimo-island-error-background,
    color-mix(in srgb, #dc2626 6%, var(--background))
  );
  --_mdxm-shadow-error-border: var(
    --marimo-island-error-border,
    color-mix(in srgb, #dc2626 42%, var(--border))
  );
  --_mdxm-shadow-error-foreground: var(--marimo-island-error-foreground, var(--foreground));
  --_mdxm-shadow-error-title: var(--marimo-island-error-accent, #dc2626);
}

:host([data-marimo-theme="dark"]) {
  color-scheme: dark;
  --background: var(--marimo-island-background, #09090b);
  --foreground: var(--marimo-island-foreground, #e4e4e7);
  --card: var(--marimo-island-surface, #18181b);
  --card-foreground: var(--foreground);
  --popover: var(--marimo-island-surface, #18181b);
  --popover-foreground: var(--foreground);
  --secondary: var(
    --marimo-island-muted-surface,
    color-mix(in srgb, var(--foreground) 10%, var(--background))
  );
  --secondary-foreground: var(--foreground);
  --muted: var(
    --marimo-island-muted-surface,
    color-mix(in srgb, var(--foreground) 10%, var(--background))
  );
  --muted-foreground: var(
    --marimo-island-muted-foreground,
    color-mix(in srgb, var(--foreground) 68%, transparent)
  );
  --border: var(--marimo-island-border, rgba(161, 161, 170, 0.34));
  --input: var(--marimo-island-border, rgba(161, 161, 170, 0.4));
  --cm-background: var(--marimo-island-code-background, #18181b);
  --cm-foreground: var(--marimo-island-code-foreground, var(--foreground));
  --cm-comment: var(--marimo-island-muted-foreground, var(--muted-foreground));
  --_mdxm-shadow-hover-background: rgba(255, 255, 255, 0.08);
  --_mdxm-shadow-error-background: var(
    --marimo-island-error-background,
    color-mix(in srgb, #f87171 8%, var(--background))
  );
  --_mdxm-shadow-error-border: var(
    --marimo-island-error-border,
    color-mix(in srgb, #f87171 42%, var(--border))
  );
  --_mdxm-shadow-error-foreground: var(--marimo-island-error-foreground, var(--foreground));
  --_mdxm-shadow-error-title: var(--marimo-island-error-accent, #fca5a5);
}

:host([data-marimo-theme="light"]) {
  color-scheme: light;
}

:host([data-marimo-theme="dark"]) :where(.contents) {
  color-scheme: dark !important;
}

:host([data-marimo-theme="light"]) :where(.contents) {
  color-scheme: light !important;
}

:host(:not([data-min-height])) :where(.cm-editor) {
  min-height: 0 !important;
}

:host :where(.marimo .h-3) {
  height: calc(var(--spacing, 0.25rem) * 3) !important;
}

:host :where(.marimo .w-3) {
  width: calc(var(--spacing, 0.25rem) * 3) !important;
}

:host :where(.marimo .h-4) {
  height: calc(var(--spacing, 0.25rem) * 4) !important;
  min-height: calc(var(--spacing, 0.25rem) * 4) !important;
}

:host :where(.marimo .w-4) {
  width: calc(var(--spacing, 0.25rem) * 4) !important;
}

:host :where(.marimo .h-6) {
  height: calc(var(--spacing, 0.25rem) * 6) !important;
  min-height: calc(var(--spacing, 0.25rem) * 6) !important;
}

:host :where(.marimo .h-px) {
  height: 1px !important;
}

:host :where(.marimo .border-input) {
  border-color: var(--input, ButtonBorder) !important;
}

:host :where(.marimo .border-primary) {
  border-color: var(--primary, Highlight) !important;
}

:host :where(.marimo .bg-background) {
  background-color: var(--background, Field) !important;
}

:host :where(.marimo .bg-border) {
  background-color: var(--border, ButtonBorder) !important;
}

:host :where(.marimo .text-muted-foreground) {
  color: var(--muted-foreground, GrayText) !important;
}

:host :where(.marimo .placeholder\\:text-muted-foreground)::placeholder {
  color: var(--muted-foreground, GrayText) !important;
}

:host :where(.marimo [data-testid="marimo-plugin-number-input"] input) {
  min-height: calc(var(--spacing, 0.25rem) * 6) !important;
}

:host :where(.marimo [data-testid="marimo-plugin-number-input"] button) {
  align-items: center !important;
  display: flex !important;
  height: auto !important;
  justify-content: center !important;
  min-height: 0 !important;
}

:host([data-marimo-theme="dark"]) :where(.marimo) {
  background: transparent !important;
  color: var(--foreground, #e4e4e7) !important;
}

:host([data-marimo-theme="dark"])
  :where(
    .admonition,
    [class*="admonition"],
    .callout,
    .marimo *:not(.cm-editor):not(.cm-editor *),
    .markdown.prose,
    .markdown.prose *,
    .codehilite,
    .codehilite *,
    .highlight,
    .highlight *,
    pre,
    pre *,
    code,
    code *,
    marimo-accordion,
    marimo-accordion *,
    table,
    thead,
    tbody,
    tr,
    th,
    td,
    .marimo-json-output,
    .marimo-json-output *,
    .json-viewer-theme-light,
    .json-viewer-theme-light *,
    label,
    input,
    output,
    [role="cell"],
    [role="columnheader"],
    [role="rowheader"]
  ) {
  color: var(--foreground, #e4e4e7) !important;
}

:host([data-marimo-theme="dark"])
  :where(.admonition, [class*="admonition"], .callout) {
  background: var(--muted, #27272a) !important;
  border-color: var(--border, rgba(161, 161, 170, 0.34)) !important;
}

:host([data-marimo-theme="dark"])
  :where(
    .bg-background,
    .bg-card,
    .bg-muted,
    .bg-secondary,
    .bg-white,
    [class*="bg-background"],
    [class*="bg-card"],
    [class*="bg-muted"],
    [class*="bg-secondary"],
    [class*="bg-white"]
  ) {
  background: var(--card, #18181b) !important;
  color: var(--foreground, #e4e4e7) !important;
}

:host([data-marimo-theme="dark"]) :where(input, textarea, select) {
  background: var(--card, #18181b) !important;
  border-color: var(--border, rgba(161, 161, 170, 0.34)) !important;
  color: var(--foreground, #e4e4e7) !important;
  color-scheme: dark !important;
}

:host([data-marimo-theme="dark"]) :where(input, textarea)::placeholder {
  color: var(--muted-foreground, #a1a1aa) !important;
}

:host([data-marimo-theme="dark"])
  :where(.cm-editor, .cm-scroller, .cm-content) {
  background: var(--cm-background, #18181b) !important;
  color: var(--cm-foreground, #e4e4e7) !important;
  --cm-background: var(--marimo-island-code-background, #18181b) !important;
  --cm-foreground: var(--marimo-island-code-foreground, var(--foreground, #e4e4e7)) !important;
}

:host([data-marimo-theme="dark"]) :where(.cm-gutters) {
  background: var(--background, #09090b) !important;
  border-color: var(--border, rgba(161, 161, 170, 0.34)) !important;
  color: var(--muted-foreground, #a1a1aa) !important;
}

:host([data-marimo-theme="dark"]) :where(.cm-activeLine, .cm-activeLineGutter) {
  background: var(--_mdxm-shadow-hover-background, rgba(255, 255, 255, 0.08)) !important;
}

:host([data-marimo-theme="dark"]) :where([role="alert"]) {
  background: var(--_mdxm-shadow-error-background, #241b1b) !important;
  border-color: var(--_mdxm-shadow-error-border, rgba(248, 113, 113, 0.42)) !important;
  color: var(--_mdxm-shadow-error-foreground, #e4e4e7) !important;
}

:host([data-marimo-theme="dark"])
  :where([role="alert"])
  :where(h1, h2, h3, h4, h5, h6, .text-destructive) {
  color: var(--_mdxm-shadow-error-title, #fca5a5) !important;
}
`;
