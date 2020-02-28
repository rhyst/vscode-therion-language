import * as vscode from "vscode";

import { activateFormatter } from "./formatting";
import { activateTemplater } from "./template";
import { activateCompile } from "./compile";
import { activateOpen } from "./open";
import {
  activateLanguageServer,
  deactivateLanguageServer
} from "./languageClient";

export function activate(context: vscode.ExtensionContext) {
  activateFormatter();
  activateTemplater(context);
  activateCompile(context);
  activateOpen(context);
  activateLanguageServer(context);
}

export function deactivate(): Thenable<void> {
  return deactivateLanguageServer();
}
