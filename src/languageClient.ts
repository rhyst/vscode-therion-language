import * as path from "path";
import * as vscode from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from "vscode-languageclient";

import { getConfig } from "./util";

let client: LanguageClient;

export const activateLanguageServer = async (
  context: vscode.ExtensionContext
) => {
  // The server is implemented in node
  let serverModule = context.asAbsolutePath(
    path.join("dist", "src", "languageServer.js")
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
      options: debugOptions
    }
  };

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for therion documents
    documentSelector: [
      { scheme: "file", language: "therion-lang" },
      { scheme: "file", language: "therion-config-lang" },
      { scheme: "file", language: "therion-2d-lang" }
    ],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: vscode.workspace.createFileSystemWatcher(
        "**/.{th,thm,th2,thc,thcfg.thconfig,thl,thlayout}"
      )
    }
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

  client.onRequest("getActiveTextEditorFileName", () => {
    return vscode.window.activeTextEditor.document.fileName;
  });
  client.onRequest("getActiveTextEditorLastCharacter", () => {
    const cursor = vscode.window.activeTextEditor.selection.active;
    const start = new vscode.Position(cursor.line, cursor.character - 1);
    const end = cursor;
    return vscode.window.activeTextEditor.document.getText(
      new vscode.Range(start, end)
    );
  });
};

export function deactivateLanguageServer(): Thenable<void> {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
