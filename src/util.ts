import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import * as cp from "child_process";
import * as vscode from "vscode";

export const exec = util.promisify(cp.exec);
export const readFile = util.promisify(fs.readFile);
export const writeFile = util.promisify(fs.writeFile);

export const outputChannel = vscode.window.createOutputChannel("Therion");

export const getConfig = key => {
  const config = vscode.workspace.getConfiguration("therion");
  const keys = key.split(".");
  if (keys.length === 1) return config.get(key);
  if (keys.length === 2) return config.get(keys[0])[keys[1]];
  return null;
};

export const compile = async filepath => {
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

const inputReg = /\n\s*(?:input|source)\s+(\S+)/g;

export const getInputs = async file => {
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
