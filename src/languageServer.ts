import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  CompletionParams,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  getCompletions,
  getCurrentNamespace,
  getRelativeNamespace,
  getIncludes,
  SourceFile,
  Namespace,
  Includes,
} from "./serverUtil";

let connection = createConnection(ProposedFeatures.all);
let documents = new TextDocuments(TextDocument);
let includes: Includes = new Map();

connection.onInitialize((params: InitializeParams) => {
  return {
    capabilities: {
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ["@"],
      },
    },
  };
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  async (params: CompletionParams): Promise<CompletionItem[]> => {
    const position = params.position;
    const { name, contents, prefix } = await connection.sendRequest(
      "getActiveTextEditorDetails"
    );

    // Get completions from files included in this file
    const currentFile = new SourceFile(name, [], contents);
    // Get completions from files that include this file
    const includeFiles = includes.get(name) || [];

    let completions = await getCompletions(
      [currentFile, ...includeFiles],
      prefix
    );

    const currentNamespace: Namespace = await getCurrentNamespace(
      currentFile,
      position.line
    );

    return completions.map((c) => {
      const namespace = getRelativeNamespace(currentNamespace, c.namespace)
        .reverse()
        .join(".");
      let label = "";
      switch (c.type) {
        case "map":
        case "scrap":
          label = `${c.name}${namespace && `@${namespace}`}`;
          break;
        case "survey":
          label = namespace;
      }
      return {
        label,
        kind: CompletionItemKind.Variable,
        data: { ...c, namespace },
        sortText: `${namespace.length}`,
      };
    });
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    const { type, name, namespace } = item.data;
    switch (type) {
      case "map":
      case "scrap":
        item.detail = `Therion ${type} name`;
        item.documentation = `${name}${namespace && `@${namespace}`}`;
        item.insertText = `${name}${namespace && `@${namespace}`}`;
        break;
      case "survey":
        item.detail = "Therion survey name";
        item.documentation = namespace;
        item.insertText = namespace;
        break;
    }
    return item;
  }
);

// Maintain a map of where filenames are used as an input or source
connection.onInitialized(async () => {
  const files: { fsPath: string }[] = await connection.sendRequest(
    "getTherionFiles"
  );
  const sourceFiles = files.map((file) => new SourceFile(file.fsPath));
  includes = await getIncludes(sourceFiles);
});

connection.onDidChangeWatchedFiles(async () => {
  const files: { fsPath: string }[] = await connection.sendRequest(
    "getTherionFiles"
  );
  const sourceFiles = files.map((file) => new SourceFile(file.fsPath));
  includes = await getIncludes(sourceFiles);
});

documents.listen(connection);
connection.listen();
