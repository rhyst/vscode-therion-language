import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  getCompletions,
  getCurrentNamespace,
  getRelativeNamespace,
  getIncludes,
} from "./serverUtil";

let connection = createConnection(ProposedFeatures.all);
let documents = new TextDocuments(TextDocument);
let includes = new Map();

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
  async ({
    position,
  }: TextDocumentPositionParams): Promise<CompletionItem[]> => {
    const fileName = await connection.sendRequest(
      "getActiveTextEditorFileName"
    );
    const lastCharacter = await connection.sendRequest(
      "getActiveTextEditorLastCharacter"
    );
    // Get completions from files included in this file
    // Get completions from files that include this file
    let completions = await getCompletions(
      [{ file: fileName, namespace: [] }, ...(includes.get(fileName) || [])],
      lastCharacter
    );

    const currentNamespace = await getCurrentNamespace(fileName, position.line);

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
  const files: { path: string }[] = await connection.sendRequest(
    "getTherionFiles"
  );
  includes = await getIncludes(files);
});

connection.onDidChangeWatchedFiles(async () => {
  const files: { path: string }[] = await connection.sendRequest(
    "getTherionFiles"
  );
  includes = await getIncludes(files);
});

documents.listen(connection);
connection.listen();
