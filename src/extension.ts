import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import * as tmp from "tmp";
import * as util from "util";
import * as cp from "child_process";
import * as chokidar from "chokidar";

const exec = util.promisify(cp.exec);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const outputChannel = vscode.window.createOutputChannel("Therion");

const getConfig = key => {
  const config = vscode.workspace.getConfiguration("therion");
  const keys = key.split(".");
  if (keys.length === 1) return config.get(key);
  if (keys.length === 2) return config.get(keys[0])[keys[1]];
  return null;
};

const startTags = /^(scrap|survey|map|centreline|centerline|line|layout|lookup|def|begingroup)(\s|$)/;
const endTages = /^(endscrap|endsurvey|endmap|endcentreline|endcenterline|endline|endlayout|endlookup|enddef(;)?|endgroup(;)?|endcode)(\s|$)/;
const code = /^code\s/;
const inlineCode = /\\/m;

export function activate(context: vscode.ExtensionContext) {
  // Formatter
  vscode.languages.registerDocumentFormattingEditProvider(
    ["therion-lang", "therion-config-lang", "therion-2d-lang"],
    {
      provideDocumentFormattingEdits(
        document: vscode.TextDocument
      ): vscode.TextEdit[] {
        const edits = [];
        let indent = 0;
        for (let i = 0; i < document.lineCount; i++) {
          const text = document.lineAt(i).text.trim();

          // Indendation
          if (endTages.test(text)) indent--;
          const newText = `${getConfig("format.indentCharacters").repeat(
            indent
          )}${text}`;
          if (startTags.test(text)) indent++;
          edits.push(
            vscode.TextEdit.replace(document.lineAt(i).range, newText)
          );

          // Special case for "code" which can be a single line or a block
          if (code.test(text)) {
            for (let j = i + 2; j < document.lineCount; j++) {
              const nextText = document.lineAt(j).text.trim();
              if (!nextText.length) continue;
              if (nextText[0] !== "\\") {
                indent++;
              }
              break;
            }
          }
        }
        return edits;
      }
    }
  );

  // Template generator

  const xviTemplate = (thFile: string, tmpFile: string) => `source ${thFile}
layout test
  scale 1 500
  endlayout
export map -projection plan -o ${tmpFile} -format xvi -layout test -layout-debug station-names`;

  const scrapTemplate = (
    name: string,
    points: string,
    lines: string
  ) => `encoding  utf-8
##XTHERION## xth_me_area_adjust 0 0 1004.000000 1282.000000
##XTHERION## xth_me_area_zoom_to 100

scrap DELETE-ME-survey-legs -projection plan -scale [0.0 0.0 500 1000.0 0.0 0.0 150 300]
${lines}
endscrap

scrap ${name}-1p -projection plan -scale [0.0 0.0 500 1000.0 0.0 0.0 150 300]
${points}
endscrap
`;

  const mapTemplate = (name: string) => `
input ${name}-p.th2

map ${getConfig("mapPrefix")}${name}-p -projection plan
    ${name}-1p
endmap

`;

  const pointTemplate = (x: string, y: string, station: string) =>
    `point ${x} ${y} station -name ${station}`;

  const lineTemplate = (x1, y1, x2, y2) => `line wall 
  ${x1} ${y1}
  ${x2} ${y2}
endline`;

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "therion.command.createScrapTemplate",
      async () => {
        const editor = vscode.window.activeTextEditor;
        // Split up file path
        const thFilePath = editor.document.fileName;
        const thFolderPath = path.dirname(thFilePath);
        const thFileName = path.basename(thFilePath);
        const thFileExt = path.extname(thFilePath);
        const name = thFileName.replace(thFileExt, "");

        // Export XVI
        const tmpConfig = tmp.fileSync();
        const tmpXVI = tmp.fileSync();
        await writeFile(tmpConfig.name, xviTemplate(thFilePath, tmpXVI.name));
        await compile(`${tmpConfig.name}`);

        // Extract points and lines from XVI
        const xviContents = await readFile(tmpXVI.name, "utf8");
        const xviLines = xviContents.split("\n").reverse();
        const points = [];
        const lines = [];
        xviLines.forEach(line => {
          let match = line.match(/{\s*(-?\d+\.\d+)\s*(-?\d+\.\d+)\s*(\d+)\s*}/);
          if (match) {
            const x = match[1];
            const y = match[2];
            const station = match[3];
            points.push(pointTemplate(x, y, station));
          }
          match = line.match(
            /{\s*(-?\d+\.\d+)\s*(-?\d+\.\d+)\s*(-?\d+\.\d+)\s*(-?\d+\.\d+)\s*}/
          );
          if (match) {
            const x1 = match[1];
            const y1 = match[2];
            const x2 = match[3];
            const y2 = match[4];
            lines.push(lineTemplate(x1, y1, x2, y2));
          }
        });

        // Write template scrap file
        await writeFile(
          path.join(thFolderPath, `${name}-p.th2`),
          scrapTemplate(name, points.join("\n"), lines.join("\n"))
        );

        // Insert scrap into map in document
        for (let i = 0; i < editor.document.lineCount; i++) {
          const text = editor.document.lineAt(i).text.trim();
          if (/^cent(re|er)line/.test(text)) {
            const centrelinePosition = editor.document.lineAt(i).range.start;
            vscode.window.activeTextEditor.edit(editBuilder => {
              editBuilder.insert(centrelinePosition, mapTemplate(name));
            });
            break;
          }
        }

        vscode.window.showInformationMessage(`Scrap created for ${name}.`);
        outputChannel.appendLine(`Scrap created for ${name}.`);
      }
    )
  );

  const compile = async filepath => {
    const name = path.basename(filepath);
    outputChannel.appendLine(`Compiling: ${name}`);
    try {
      await exec(`${getConfig("therionPath")} ${filepath}`);
      outputChannel.appendLine(`Compiled: ${name}`);
      vscode.window.showInformationMessage(`Compiled: ${name}`);
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to compile: ${name}`);
      outputChannel.appendLine(`Failed to compile: ${name}`);
      outputChannel.appendLine(`stderr:`);
      e.stderr
        .toString()
        .split("\n")
        .map(line => outputChannel.appendLine(`\t${line.trim()}`));
      outputChannel.appendLine(`stdout:`);
      e.stdout
        .toString()
        .split("\n")
        .map(line => outputChannel.appendLine(`\t${line.trim()}`));
      outputChannel.show(true);
    }
  };

  // Compile thconfig
  context.subscriptions.push(
    vscode.commands.registerCommand("therion.command.compile", () => {
      const editor = vscode.window.activeTextEditor;
      const thFilePath = editor.document.fileName;
      compile(thFilePath);
    })
  );

  // Watch thconfig
  const watchStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    0
  );
  context.subscriptions.push(watchStatusBarItem);
  watchStatusBarItem.command = "therion.command.stop-watch";
  watchStatusBarItem.hide();

  const watches = new Map();

  const startWatch = (key, name, files) => {
    const watcher = chokidar.watch(files);
    watcher.on("change", path => {
      outputChannel.appendLine(`Changed: ${path}`);
      compile(key);
    });
    watches.set(key, { name, file: key, watcher });
    updateWatchStatus();
    vscode.window.showInformationMessage(`Started watching ${name}.`);
    outputChannel.appendLine(`Started watching ${name}.`);
    compile(key);
  };

  const stopWatch = key => {
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

  const inputReg = /\n\s*(?:input|source)\s+(\S+)/g;

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
      const getInputs = async file => {
        const text = await readFile(file, "utf8");
        const inputs = Array.from(text.matchAll(inputReg)).map(i => {
          const j = path.join(path.dirname(file), i[1].replace(/\"/g, ""));
          return path.extname(j) ? j : `${j}.th`;
        });
        let files = [file];
        for (const input of inputs) {
          const moreFiles = await getInputs(input);
          files = files.concat(...moreFiles);
        }
        return files;
      };
      const files = await getInputs(file);
      startWatch(file, name, files);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("therion.command.stop-watch", e => {
      const watchesArr = Array.from(watches.values());
      if (watchesArr.length === 1) {
        stopWatch(watchesArr[0].file);
        return;
      }
      const quickPick = vscode.window.createQuickPick();
      let selection = null;
      quickPick.items = watchesArr.map(watch => ({
        label: `Stop watching ${watch.name}`,
        name: watch.name,
        file: watch.file
      }));
      quickPick.title = "Choose a file to stop watching";
      quickPick.onDidChangeSelection(s => (selection = s));
      quickPick.onDidAccept(() => {
        quickPick.hide();
        stopWatch(selection[0].file);
      });
      quickPick.show();
    })
  );

  // Open in Inkscape Context Command
  context.subscriptions.push(
    vscode.commands.registerCommand("therion.context.openInInkscape", file => {
      cp.exec(`${getConfig("inkscapePath")} ${file.path}`);
    })
  );
}
