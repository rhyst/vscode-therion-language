import * as vscode from "vscode";
import { getConfig } from "./util";

const startTags = /^(scrap|survey|map|centreline|centerline|line|layout|lookup|def|begingroup|code$|source$)(\s|$)/;
const endTages = /^(endscrap|endsurvey|endmap|endcentreline|endcenterline|endline|endlayout|endlookup|enddef(;)?|endgroup(;)?|endcode|endsource)(\s|$)/;

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
        let begin = true;
        for (let i = 0; i < document.lineCount; i++) {
          const text = document.lineAt(i).text.trim();

          // Remove leading whitespace
          if (begin && /^\s*$/.test(text)) {
            edits.push(
              vscode.TextEdit.delete(
                new vscode.Range(
                  document.lineAt(i).range.start,
                  document.lineAt(i + 1).range.start
                )
              )
            );
          } else if (begin) {
            begin = false;
          }

          // Indendation
          if (endTages.test(text)) indent--;
          const newText = `${getConfig("format.indentCharacters").repeat(
            indent
          )}${text}`;
          if (startTags.test(text)) indent++;
          edits.push(
            vscode.TextEdit.replace(document.lineAt(i).range, newText)
          );
        }
        return edits;
      }
    }
  );
}
