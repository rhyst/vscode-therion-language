import * as path from "path";
import * as vscode from "vscode";
import * as tmp from "tmp";

import { compile, readFile, writeFile, getConfig, outputChannel } from "./util";

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

const getMapName = (name: string) =>
  `${getConfig("mapName").replace("{name}", name)}`;

const mapTemplate = (name: string) => `
input ${name}-p.th2

map ${getMapName(name)} -projection plan
    ${name}-1p
endmap

`;

const pointTemplate = (x: string, y: string, station: string) =>
  `point ${x} ${y} station -name ${station}`;

const lineTemplate = (x1, y1, x2, y2) => `line wall 
${x1} ${y1}
${x2} ${y2}
endline`;

export function activateTemplater(context: vscode.ExtensionContext) {
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
}
