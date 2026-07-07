export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonRecord | JsonValue[];
export type JsonRecord = {
  [key: string]: JsonValue;
};

export type MarimoLanguage = "python" | "sql" | "markdown";

export type MarimoDiagnostic = {
  severity: "warning" | "error";
  message: string;
  cellIndex?: number;
  line?: number;
};

export type MarimoCellOptions = {
  language: MarimoLanguage;
  render: {
    source: boolean;
    output: boolean;
    include: boolean;
    editor: boolean;
    error: boolean;
    serverOutput: boolean;
  };
  execution: {
    enabled: boolean;
  };
  marimo: {
    disabled: boolean;
    unparsable: boolean;
  };
  sql?: {
    outputName?: string;
    engine?: string;
  };
  name?: string;
  column?: number;
};

export type MarimoCell = {
  index: number;
  source: string;
  options: MarimoCellOptions;
  startLine?: number;
  endLine?: number;
};

export type MarimoRuntimeAssets = {
  moduleScripts: string[];
  links: Record<string, string>[];
  headTags?: {
    tag: string;
    attrs: Record<string, string>;
    text?: string;
  }[];
  exportContext?: {
    trusted: true;
    notebookCode?: string;
  };
  version?: string;
};

export type MarimoOutput = {
  html: string;
  appId: string;
  assets?: MarimoRuntimeAssets;
  cellIndex: number;
  runtimeCellCount: number;
  options: MarimoCellOptions;
  diagnostics?: MarimoDiagnostic[];
};

export type MarimoMdxElementOutput = {
  type?: "element";
  elementName?: string;
  clientImportSource?: string;
  theme?: "auto" | "light" | "dark";
};

export type MarimoMdxComponentOutput = {
  type: "component";
  componentName?: string;
  importSource: string;
  importName?: string;
};

export type MarimoMdxOutput = MarimoMdxElementOutput | MarimoMdxComponentOutput;

export type MarimoPageRequest = {
  filename: string;
  identity: string;
  metadata: {
    pyproject?: string;
  };
  diagnostics: MarimoDiagnostic[];
  cells: MarimoCell[];
};

export type MarimoPageResult = {
  outputs: MarimoOutput[];
  diagnostics?: MarimoDiagnostic[];
};

export type MarimoExtractor = (
  request: MarimoPageRequest,
) => MarimoPageResult | Promise<MarimoPageResult>;

export type MdxMarimoOptions = {
  cwd?: string;
  output?: MarimoMdxOutput;
  identity?: string | ((document: { filename: string; filePath: string | undefined }) => string);
  extract: MarimoExtractor;
};
