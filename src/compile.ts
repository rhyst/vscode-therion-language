import * as path from "path";
import * as vscode from "vscode";
import * as chokidar from "chokidar";
import { platform } from "process";

import { compile, outputChannel, getInputs } from "./util";

export function activateCompile(context: vscode.ExtensionContext) {
  // Compile thconfig
  context.subscriptions.push(
    vscode.commands.registerCommand("therion.command.compile", () => {
      const editor = vscode.window.activeTextEditor;
      const thFilePath = editor.document.fileName;
      compile(thFilePath);
    })
  );
  vscode.commands.registerCommand("therion.context.compile", (file) => {
    compile(file.fsPath);
  });

  // Watch thconfig
  const watchStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    0
  );
  context.subscriptions.push(watchStatusBarItem);
  watchStatusBarItem.command = "therion.command.stop-watch";
  watchStatusBarItem.hide();

  const watches = new Map();

  const startWatch = async (file, name) => {
    const files = await getInputs(file);
    const watcher = chokidar.watch(files);
    watcher.on("change", (path) => {
      outputChannel.appendLine(`Changed: ${path}`);
      watcher.close();
      startWatch(file, name);
    });
    watches.set(file, { name, file, watcher });
    updateWatchStatus();
    compile(file);
  };

  const stopWatch = (key) => {
    const { name, watcher } = watches.get(key);
    watcher.close();
    watches.delete(key);
    updateWatchStatus();
    vscode.window.showInformationMessage(`Stopped watching ${name}.`);
    outputChannel.appendLine(`Stopped watching ${name}.`);
  };

  const updateWatchStatus = () => {
    if (watches.size === 0) {
      watchStatusBarItem.hide();
      return;
    }
    watchStatusBarItem.show();
    if (watches.size === 1) {
      watchStatusBarItem.text = `Therion watching: ${path.basename(
        Array.from(watches.values())[0].name
      )}`;
    } else {
      watchStatusBarItem.text = `Therion watching: ${watches.size} files`;
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("therion.command.watch", async () => {
      const file = vscode.window.activeTextEditor.document.fileName;
      const name = path.basename(file);
      if (watches.get(file)) {
        vscode.window.showInformationMessage(
          `${name} is already being watched.`
        );
        return;
      }
      vscode.window.showInformationMessage(`Started watching ${name}.`);
      outputChannel.appendLine(`Started watching ${name}.`);
      outputChannel.show(true);
      startWatch(file, name);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("therion.command.stop-watch", (e) => {
      const watchesArr = Array.from(watches.values());
      if (watchesArr.length === 1) {
        stopWatch(watchesArr[0].file);
        return;
      }
      const quickPick = vscode.window.createQuickPick();
      let selection = null;
      quickPick.items = watchesArr.map((watch) => ({
        label: `Stop watching ${watch.name}`,
        name: watch.name,
        file: watch.file,
      }));
      quickPick.title = "Choose a file to stop watching";
      quickPick.onDidChangeSelection((s) => (selection = s));
      quickPick.onDidAccept(() => {
        quickPick.hide();
        stopWatch(selection[0].file);
      });
      quickPick.show();
    })
  );
}
