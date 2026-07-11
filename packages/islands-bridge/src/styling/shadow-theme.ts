export const SHADOW_THEME_STYLE_ID = "marimo-island-shadow-theme";

export const SHADOW_THEME_CSS = `
:host {
  color-scheme: inherit;
  --_marimo-island-shadow-background: var(--marimo-island-background, #ffffff);
  --_marimo-island-shadow-foreground: var(--marimo-island-foreground, #0f172a);
  --_marimo-island-shadow-card: var(--marimo-island-surface, #ffffff);
  --_marimo-island-shadow-primary: var(--marimo-island-accent, #0880ea);
  --_marimo-island-shadow-primary-foreground: var(
    --marimo-island-accent-foreground,
    #f8fafc
  );
  --_marimo-island-shadow-muted: var(
    --marimo-island-muted-surface,
    #f1f5f9
  );
  --_marimo-island-shadow-muted-foreground: var(
    --marimo-island-muted-foreground,
    #64748b
  );
  --_marimo-island-shadow-border: var(--marimo-island-border, #e2e8f0);
  --_marimo-island-shadow-input: var(--marimo-island-border, #a3a3a3);
  --_marimo-island-shadow-code-background: var(
    --marimo-island-code-background,
    var(--_marimo-island-shadow-background)
  );
  --_marimo-island-shadow-code-foreground: var(
    --marimo-island-code-foreground,
    var(--_marimo-island-shadow-foreground)
  );
  --background: var(--marimo-island-background, #ffffff);
  --foreground: var(--marimo-island-foreground, #0f172a);
  --card: var(--marimo-island-surface, #ffffff);
  --card-foreground: var(--foreground);
  --popover: var(--marimo-island-surface, #ffffff);
  --popover-foreground: var(--foreground);
  --primary: var(--marimo-island-accent, #0880ea);
  --primary-foreground: var(--marimo-island-accent-foreground, #f8fafc);
  --secondary: var(
    --marimo-island-muted-surface,
    #f1f5f9
  );
  --secondary-foreground: var(--foreground);
  --muted: var(
    --marimo-island-muted-surface,
    #f1f5f9
  );
  --muted-foreground: var(
    --marimo-island-muted-foreground,
    #64748b
  );
  --accent: var(--marimo-island-accent, #0880ea);
  --accent-foreground: var(--marimo-island-accent-foreground, #f8fafc);
  --border: var(--marimo-island-border, #e2e8f0);
  --input: var(--marimo-island-border, #a3a3a3);
  --ring: var(--marimo-island-focus-ring, var(--primary));
  --cm-background: var(--marimo-island-code-background, var(--background));
  --cm-foreground: var(--marimo-island-code-foreground, var(--foreground));
  --cm-comment: var(--marimo-island-muted-foreground, var(--muted-foreground));
  --radius: var(--marimo-island-radius, 0.5rem);
  --_marimo-island-shadow-hover-background: color-mix(
    in srgb,
    var(--_marimo-island-shadow-foreground) 8%,
    transparent
  );
  --_marimo-island-shadow-error-background: var(
    --marimo-island-error-background,
    color-mix(in srgb, #dc2626 6%, var(--_marimo-island-shadow-background))
  );
  --_marimo-island-shadow-error-border: var(
    --marimo-island-error-border,
    color-mix(in srgb, #dc2626 42%, var(--_marimo-island-shadow-border))
  );
  --_marimo-island-shadow-error-foreground: var(
    --marimo-island-error-foreground,
    var(--_marimo-island-shadow-foreground)
  );
  --_marimo-island-shadow-error-title: var(--marimo-island-error-accent, #dc2626);
}

:host([data-marimo-theme="dark"]) {
  color-scheme: dark;
  --_marimo-island-shadow-background: var(--marimo-island-background, #181c1a);
  --_marimo-island-shadow-foreground: var(--marimo-island-foreground, #eceeed);
  --_marimo-island-shadow-card: var(--marimo-island-surface, #252927);
  --_marimo-island-shadow-muted: var(
    --marimo-island-muted-surface,
    #020303
  );
  --_marimo-island-shadow-muted-foreground: var(
    --marimo-island-muted-foreground,
    #aab2af
  );
  --_marimo-island-shadow-border: var(--marimo-island-border, #3b403e);
  --_marimo-island-shadow-input: var(--marimo-island-border, #474c4a);
  --_marimo-island-shadow-code-background: var(--marimo-island-code-background, #282c34);
  --_marimo-island-shadow-code-foreground: var(
    --marimo-island-code-foreground,
    var(--_marimo-island-shadow-foreground)
  );
  --background: var(--marimo-island-background, #181c1a);
  --foreground: var(--marimo-island-foreground, #eceeed);
  --card: var(--marimo-island-surface, #252927);
  --card-foreground: var(--foreground);
  --popover: var(--marimo-island-surface, #252927);
  --popover-foreground: var(--foreground);
  --secondary: var(
    --marimo-island-muted-surface,
    #020303
  );
  --secondary-foreground: var(--foreground);
  --muted: var(
    --marimo-island-muted-surface,
    #020303
  );
  --muted-foreground: var(
    --marimo-island-muted-foreground,
    #aab2af
  );
  --border: var(--marimo-island-border, #3b403e);
  --input: var(--marimo-island-border, #474c4a);
  --cm-background: var(--marimo-island-code-background, #282c34);
  --cm-foreground: var(--marimo-island-code-foreground, var(--foreground));
  --cm-comment: var(--marimo-island-muted-foreground, var(--muted-foreground));
  --_marimo-island-shadow-hover-background: rgba(255, 255, 255, 0.08);
  --_marimo-island-shadow-error-background: var(
    --marimo-island-error-background,
    color-mix(in srgb, #f87171 8%, var(--_marimo-island-shadow-background))
  );
  --_marimo-island-shadow-error-border: var(
    --marimo-island-error-border,
    color-mix(in srgb, #f87171 42%, var(--_marimo-island-shadow-border))
  );
  --_marimo-island-shadow-error-foreground: var(
    --marimo-island-error-foreground,
    var(--_marimo-island-shadow-foreground)
  );
  --_marimo-island-shadow-error-title: var(--marimo-island-error-accent, #fca5a5);
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
  border-color: var(--_marimo-island-shadow-input, #a3a3a3) !important;
}

:host :where(.marimo .border-primary) {
  border-color: var(--_marimo-island-shadow-primary, #0880ea) !important;
}

:host :where(.marimo .bg-background) {
  background-color: var(--_marimo-island-shadow-background, #ffffff) !important;
}

:host :where(.marimo .bg-border) {
  background-color: var(--_marimo-island-shadow-border, #e2e8f0) !important;
}

:host :where(.marimo .text-muted-foreground) {
  color: var(--_marimo-island-shadow-muted-foreground, #64748b) !important;
}

:host :where(.marimo .placeholder\\:text-muted-foreground)::placeholder {
  color: var(--_marimo-island-shadow-muted-foreground, #64748b) !important;
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
  color: var(--_marimo-island-shadow-foreground, #eceeed) !important;
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
  color: var(--_marimo-island-shadow-foreground, #eceeed) !important;
}

:host([data-marimo-theme="dark"])
  :where(.admonition, [class*="admonition"], .callout) {
  background: var(--_marimo-island-shadow-muted, #020303) !important;
  border-color: var(--_marimo-island-shadow-border, #3b403e) !important;
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
  background: var(--_marimo-island-shadow-card, #252927) !important;
  color: var(--_marimo-island-shadow-foreground, #eceeed) !important;
}

:host([data-marimo-theme="dark"]) :where(input, textarea, select) {
  background: var(--_marimo-island-shadow-card, #252927) !important;
  border-color: var(--_marimo-island-shadow-border, #3b403e) !important;
  color: var(--_marimo-island-shadow-foreground, #eceeed) !important;
  color-scheme: dark !important;
}

:host([data-marimo-theme="dark"]) :where(input, textarea)::placeholder {
  color: var(--_marimo-island-shadow-muted-foreground, #aab2af) !important;
}

:host([data-marimo-theme="dark"])
  :where(.cm-editor, .cm-scroller, .cm-content) {
  background: var(--_marimo-island-shadow-code-background, #282c34) !important;
  color: var(--_marimo-island-shadow-code-foreground, #abb2bf) !important;
  --cm-background: var(--_marimo-island-shadow-code-background, #282c34) !important;
  --cm-foreground: var(--_marimo-island-shadow-code-foreground, #abb2bf) !important;
}

:host([data-marimo-theme="dark"]) :where(.cm-gutters) {
  background: var(--_marimo-island-shadow-background, #181c1a) !important;
  border-color: var(--_marimo-island-shadow-border, #3b403e) !important;
  color: var(--_marimo-island-shadow-muted-foreground, #aab2af) !important;
}

:host([data-marimo-theme="dark"]) :where(.cm-activeLine, .cm-activeLineGutter) {
  background: var(--_marimo-island-shadow-hover-background, rgba(255, 255, 255, 0.08)) !important;
}

:host([data-marimo-theme="dark"]) :where([role="alert"]) {
  background: var(--_marimo-island-shadow-error-background, #241b1b) !important;
  border-color: var(--_marimo-island-shadow-error-border, rgba(248, 113, 113, 0.42)) !important;
  color: var(--_marimo-island-shadow-error-foreground, #eceeed) !important;
}

:host([data-marimo-theme="dark"])
  :where([role="alert"])
  :where(h1, h2, h3, h4, h5, h6, .text-destructive) {
  color: var(--_marimo-island-shadow-error-title, #fca5a5) !important;
}
`;
