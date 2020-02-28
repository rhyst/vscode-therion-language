import * as vscode from "vscode";
import { getConfig } from "./util";

const startTags = /^(scrap|survey|map|centreline|centerline|line|layout|lookup|def|begingroup)(\s|$)/;
const endTages = /^(endscrap|endsurvey|endmap|endcentreline|endcenterline|endline|endlayout|endlookup|enddef(;)?|endgroup(;)?|endcode)(\s|$)/;
const code = /^code\s/;

export function activateFormatter() {
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
}
