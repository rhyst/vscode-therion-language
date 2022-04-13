import * as vscode from "vscode";
import { getConfig } from "./util";

const startTags =
  /^(scrap|survey|map|centreline|centerline|line|layout|lookup|def|vardef|begingroup|code|revise\s+\S+$|source$|beginpattern.*|if|else:;?|elseif)(\s|$)/;
const endTags =
  /(^|\s)(endscrap|endsurvey|endmap|endcentreline|endcenterline|endline|endlayout|endlookup|enddef(;)?|endgroup(;)?|endcode|endrevise|endsource|endpattern(;)?|fi(;)?|else:;?|elseif)(\s|$)/;

export function activateFormatter() {
  // Formatter
  vscode.languages.registerDocumentFormattingEditProvider(["therion-lang", "therion-config-lang", "therion-2d-lang"], {
    provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
      const edits = [];
      let indent = 0;
      let begin = true;
      for (let i = 0; i < document.lineCount; i++) {
        const origText = document.lineAt(i).text;
        const text = origText.trim();

        // Remove leading whitespace
        if (begin && /^\s*$/.test(text)) {
          edits.push(
            vscode.TextEdit.delete(new vscode.Range(document.lineAt(i).range.start, document.lineAt(i + 1).range.start))
          );
        } else if (begin) {
          begin = false;
        }

        // Indendation
        if (text[0] !== "#" && endTags.test(text)) indent--;
        if (indent < 0) {
          console.warn("Indent became less than zero");
          indent = 0;
        }
        const newText = `${getConfig("format.indentCharacters").repeat(indent)}${text}`;
        if (text[0] !== "#" && startTags.test(text)) indent++;
        if (newText !== origText) {
          edits.push(vscode.TextEdit.replace(document.lineAt(i).range, newText));
        }
      }
      return edits;
    },
  });
}
