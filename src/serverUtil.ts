import { join, dirname, extname } from "path";
import { readFileSync } from "fs";

const inputReg = /(?:\n|^)\s*(?:input|source)\s+(\S+)/;
const nameReg = /(?:\n|^)\s*(map|scrap)\s+(\S+)/;
const surveyReg = /(?:\n|^)\s*survey\s+(\S+)/;
const endSurveyReg = /(?:\n|^)\s*endsurvey/;

export type Includes = Map<string, SourceFile[]>;
export type Namespace = string[];
export type CompletionType = "survey" | "map" | "scrap";
export type SeenFiles = Set<string>;

export interface Completion {
  name: string;
  type: CompletionType;
  namespace: Namespace;
}

export class SourceFile {
  name: string = null;
  namespace: Namespace = [];
  contents: string = null;

  constructor(fileName, namespace = [], fileContents = null) {
    this.name = fileName;
    this.namespace = [...namespace];
    this.contents = fileContents;
  }

  getLines = () => {
    if (this.contents) {
      return this.contents.split("\n");
    } else {
      return readFileSync(this.name, { encoding: "utf-8" }).split("\n");
    }
  };
}

/**
 * Recursively search all files included/sourced in the given file and assemble
 * a list of map, scrap, and survey names that could be autocompleted.
 * @param file The path of the file to search.
 * @param prevCharacter The character before the cursor for this autocomplete.
 */
export const getCompletions = async (
  files: SourceFile[],
  prevCharacter: String = null
): Promise<Completion[]> => {
  let completions = [];
  for (const file of files) {
    completions = completions.concat(await _getCompletions(file));
  }

  if (prevCharacter === "@") {
    return completions.filter((c) => c.type === "survey");
  }
  return completions.filter((c) => c.type !== "survey");
};

/**
 * Recursive function for getCompletions.
 * @param file The path of the file to search.
 * @param initialNamespace The namespace where this file was included
 * @param seen A set of strings we already have as completions.
 * @param s The relative survey namespace of the file.
 */
export const _getCompletions = async (
  file: SourceFile,
  seen: SeenFiles = new Set()
): Promise<Completion[]> => {
  const inputs: SourceFile[] = []; // List of included files we've found
  const namespace: Namespace = []; // Namespace at the current line in the file
  let completions: Completion[] = [];

  for (let line of file.getLines()) {
    const absoluteNamespace = file.namespace.concat(namespace);
    const inputMatch = line.match(inputReg);
    if (inputMatch) {
      const [, relativePath] = inputMatch;
      const fullPath = join(
        dirname(file.name),
        relativePath.replace(/\"/g, "")
      );
      const fullPathWithExt = extname(fullPath) ? fullPath : `${fullPath}.th`;
      inputs.push(new SourceFile(fullPathWithExt, absoluteNamespace));
      continue;
    }

    // Find any names
    const nameMatch = line.match(nameReg);
    if (nameMatch) {
      const [, type, name] = nameMatch as [any, CompletionType, string];
      const key = `${type}~${name}~${absoluteNamespace.join(".")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      completions.push({
        name,
        type,
        namespace: absoluteNamespace,
      });
      continue;
    }

    // Set current survey path
    const surveyMatch = line.match(surveyReg);
    if (surveyMatch) {
      const [, surveyName] = surveyMatch;
      namespace.push(surveyName);
      const key = `survey~${surveyName}~${absoluteNamespace.join(".")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      completions.push({
        name: surveyName,
        type: "survey",
        namespace: file.namespace.concat(namespace),
      });
      continue;
    }
    const endSurveyMatch = line.match(endSurveyReg);
    if (endSurveyMatch) {
      namespace.pop();
    }
  }
  for (const input of inputs) {
    const moreCompletions = await _getCompletions(input, seen);
    completions = completions.concat(...moreCompletions);
  }
  return completions;
};

/**
 * Get the survey namespace at the cursor location. To generate correct
 * relative namespace paths from autocomplete suggestsions.
 * @param file The file the cursor is in.
 * @param lineNo The line number in the file.
 * @param options Other options including `isFileContents` which indiciates
 * that `file` is the contents of the file not the filename.
 */
export const getCurrentNamespace = (
  file: SourceFile,
  lineNo: number
): Namespace => {
  const survey = [];
  let i = 0;
  for (const line of file.getLines()) {
    const surveyMatch = line.match(surveyReg);
    if (surveyMatch) {
      const [, surveyName] = surveyMatch;
      survey.push(surveyName);
      continue;
    }
    if (i === lineNo) {
      return survey;
    }
    const endSurveyMatch = line.match(endSurveyReg);
    if (endSurveyMatch) {
      survey.pop();
    }
    i++;
  }
  return survey;
};

/**
 * Get the relative namespace path between two namespace strings.
 * @param a First namespace string.
 * @param b Second namespace string.
 */
export const getRelativeNamespace = (a: Namespace, b: Namespace): Namespace => {
  if (a.length > b.length) return [...b];
  let i: number;
  for (i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return [...b];
  }
  return [...b].slice(i);
};

/**
 * Generate map of filenames to files where they are included
 * @param files A list of files to search.
 */
export const getIncludes = async (files: SourceFile[]): Promise<Includes> => {
  let includes: Includes = new Map();
  for (const file of files) {
    const namespace = [];
    let lineNo = 0;
    for (let line of file.getLines()) {
      // Find more inputs
      const inputMatch = line.match(inputReg);
      if (inputMatch) {
        const namespace = getCurrentNamespace(file, lineNo);
        const [, relativePath] = inputMatch;
        const fullPath = join(
          dirname(file.name),
          relativePath.replace(/\"/g, "")
        );
        const fullPathWithExt = extname(fullPath) ? fullPath : `${fullPath}.th`;
        const existingIncludes = includes.get(fullPathWithExt) || [];
        includes.set(fullPathWithExt, [
          ...existingIncludes,
          new SourceFile(file.name, namespace),
        ]);
      }
      // Set current survey path
      const surveyMatch = line.match(surveyReg);
      if (surveyMatch) {
        const [, surveyName] = surveyMatch;
        namespace.push(surveyName);
      }
      const endSurveyMatch = line.match(endSurveyReg);
      if (endSurveyMatch) {
        namespace.pop();
      }

      lineNo = lineNo + 1;
    }
  }
  return includes;
};
