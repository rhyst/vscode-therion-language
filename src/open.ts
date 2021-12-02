import * as vscode from "vscode";
import { exec, getConfig } from "./util";
import open from "open";

export function activateOpen(context: vscode.ExtensionContext) {
  // Open in Inkscape Context Command
  context.subscriptions.push(
    vscode.commands.registerCommand("therion.context.openInInkscape", (file: vscode.Uri) => {
      let filePath = file.fsPath;
      if (vscode.env.remoteName === "wsl" && getConfig("wslName")) {
        if (getConfig("wslInkscapeOnly")) {
          exec(`${getConfig("inkscapePath")} "${file.fsPath}"`);
          return;
        }
        filePath = `//wsl$/${getConfig("wslName")}${file.fsPath}`.replace(/\//g, "\\");
      }
      open(filePath, { app: { name: getConfig("inkscapePath") } });
    })
  );
  if (getConfig("showOpen")) {
    // Open Context Command
    context.subscriptions.push(
      vscode.commands.registerCommand("therion.context.open", (file: vscode.Uri) => {
        let filePath = file.fsPath;
        if (vscode.env.remoteName === "wsl" && getConfig("wslName")) {
          filePath = `//wsl$/${getConfig("wslName")}${file.fsPath}`.replace(/\//g, "\\");
        }
        open(filePath);
      })
    );
  }
}
