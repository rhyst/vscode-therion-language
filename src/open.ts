import * as vscode from "vscode";
import { getConfig } from "./util";
import path from "path";
import open from "open";

export function activateOpen(context: vscode.ExtensionContext) {
  // Open in Inkscape Context Command
  context.subscriptions.push(
    vscode.commands.registerCommand("therion.context.openInInkscape", (file: vscode.Uri) => {
      let filePath = file.fsPath;
      if (vscode.env.remoteName === "wsl" && getConfig("wslName")) {
        open(`\\\\wsl$\\${getConfig("wslName")}\\${file.fsPath.replace(path.posix.sep, path.win32.sep)}`, {
          app: { name: "inkscape" },
        });
      } else {
        open(filePath, { app: { name: "inkscape" } });
      }
    })
  );
  if (getConfig("showOpen")) {
    // Open Context Command
    context.subscriptions.push(
      vscode.commands.registerCommand("therion.context.open", (file: vscode.Uri) => {
        let filePath = file.fsPath;
        if (vscode.env.remoteName === "wsl" && getConfig("wslName")) {
          open(`\\\\wsl$\\${getConfig("wslName")}\\${file.fsPath.replace(path.posix.sep, path.win32.sep)}`);
        } else {
          open(filePath);
        }
      })
    );
  }
}
