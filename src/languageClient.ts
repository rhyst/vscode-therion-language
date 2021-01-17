import * as path from "path";
import * as vscode from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient";

let client: LanguageClient;

export const activateLanguageServer = async (
  context: vscode.ExtensionContext
) => {
  // The server is implemented in node
  let serverModule = context.asAbsolutePath(
    path.join("dist", "languageServer.js")
  );
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for therion documents
    documentSelector: [
      { scheme: "file", language: "therion-lang" },
      { scheme: "file", language: "therion-config-lang" },
      { scheme: "file", language: "therion-2d-lang" },
    ],
    synchronize: {
      // Notify the server about file changes to files contained in the workspace
      fileEvents: vscode.workspace.createFileSystemWatcher(
        "**/.{th,thm,th2,thc,thcfg,thconfig,thl,thlayout}"
      ),
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "therionLanguageServer",
    "Therion Language Server",
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();

  await client.onReady();

  // Client/server communication
  client.onRequest("getActiveTextEditorDetails", () => {
    const cursor = vscode.window.activeTextEditor.selection.active;
    const word = vscode.window.activeTextEditor.document.getWordRangeAtPosition(
      cursor
    );
    const start = word ? word.start : cursor;
    let prefix = "";
    if (start.character !== 0) {
      const range = new vscode.Range(start.translate(0, -1), start);
      prefix = vscode.window.activeTextEditor.document.getText(range);
    }
    return {
      name: vscode.window.activeTextEditor.document.fileName,
      contents: vscode.window.activeTextEditor.document.getText(),
      prefix,
    };
  });

  client.onRequest("getTherionFiles", async () => {
    const files = await vscode.workspace.findFiles(
      "**/*.{th,thm,th2,thc,thcfg,thconfig,thl,thlayout}"
    );
    return files.filter((f) => f.fsPath);
  });
};

export function deactivateLanguageServer(): Thenable<void> {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
