import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  getCompletions,
  getCurrentSurveyPath,
  getRelativeSurveyPath
} from "./serverUtil";

let connection = createConnection(ProposedFeatures.all);
let documents = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams) => {
  return {
    capabilities: {
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ["@"]
      }
    }
  };
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  async ({
    position
  }: TextDocumentPositionParams): Promise<CompletionItem[]> => {
    const fileName = await connection.sendRequest(
      "getActiveTextEditorFileName"
    );
    const lastCharacter = await connection.sendRequest(
      "getActiveTextEditorLastCharacter"
    );
    const completions = await getCompletions(fileName, lastCharacter);
    const currentSurveyPath = await getCurrentSurveyPath(
      fileName,
      position.line
    );

    return completions.map(c => {
      const survey = getRelativeSurveyPath(currentSurveyPath, c.survey)
        .reverse()
        .join(".");
      let label = "";
      switch (c.type) {
        case "map":
        case "scrap":
          label = `${c.name}${survey && `@${survey}`}`;
          break;
        case "survey":
          label = survey;
      }
      return {
        label,
        kind: CompletionItemKind.Variable,
        data: { ...c, survey }
      };
    });
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    const { type, name, survey } = item.data;
    switch (type) {
      case "map":
      case "scrap":
        item.detail = `Therion ${type} name`;
        item.documentation = `${name}${survey && `@${survey}`}`;
        item.insertText = `${name}${survey && `@${survey}`}`;
        break;
      case "survey":
        item.detail = "Therion survey name";
        item.documentation = survey;
        item.insertText = survey;
        break;
    }
    return item;
  }
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
