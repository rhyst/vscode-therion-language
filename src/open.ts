import * as vscode from "vscode";
import { platform } from "process";
import { exec, getConfig } from "./util";

export function activateOpen(context: vscode.ExtensionContext) {
  // Open in Inkscape Context Command
  context.subscriptions.push(
    vscode.commands.registerCommand("therion.context.openInInkscape", file => {
      exec(`${getConfig("inkscapePath")} ${file.path}`);
    })
  );
  if (getConfig("showOpen")) {
    // Open Context Command
    context.subscriptions.push(
      vscode.commands.registerCommand("therion.context.open", file => {
        if (platform === "linux") {
          exec(`${"xdg-open"} ${file.path}`);
        } else if (platform === "darwin") {
          exec(`${"open"} ${file.path}`);
        }
      })
    );
  }
}
