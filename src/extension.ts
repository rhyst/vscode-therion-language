import * as vscode from "vscode";

const startTags = /^(scrap|survey|map|centreline|centerline|line)\b/;
const endTages = /^(endscrap|endsurvey|endmap|endcentreline|endcenterline|endline)\b/;

export function activate(context: vscode.ExtensionContext) {
  vscode.languages.registerDocumentFormattingEditProvider("therion-lang", {
    provideDocumentFormattingEdits(
      document: vscode.TextDocument
    ): vscode.TextEdit[] {
      const edits = [];
      let indent = 0;
      for (let i = 0; i < document.lineCount; i++) {
        const text = document.lineAt(i).text.trim();
        if (endTages.test(text)) indent--;
        const newText = `${"\t".repeat(indent)}${text}`;
        if (startTags.test(text)) indent++;
        edits.push(vscode.TextEdit.replace(document.lineAt(i).range, newText));
      }
      return edits;
    }
  });
}
