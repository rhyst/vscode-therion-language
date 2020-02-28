import * as vscode from "vscode";

import { exec, getConfig } from "./util";

export function activateOpen(context: vscode.ExtensionContext) {
  // Open in Inkscape Context Command
  context.subscriptions.push(
    vscode.commands.registerCommand("therion.context.openInInkscape", file => {
      exec(`${getConfig("inkscapePath")} ${file.path}`);
    })
  );
}
