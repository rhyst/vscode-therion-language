import * as fs from "fs";
import { join, dirname, extname } from "path";
import * as util from "util";
import LineByLine from "n-readlines";

export const readFile = util.promisify(fs.readFile);

const inputReg = /(?:\n|^)\s*(?:input|source)\s+(\S+)/;
const nameReg = /(?:\n|^)\s*(map|scrap)\s+(\S+)/;
const surveyReg = /(?:\n|^)\s*survey\s+(\S+)/;
const endSurveyReg = /(?:\n|^)\s*endsurvey/;

/**
 * Recursively search all files included/sourced in the given file and assemble
 * a list of map, scrap, and survey names that could be autocompleted.
 * @param file The path of the file to search.
 * @param prevCharacter The character before the cursor for this autocomplete.
 */
export const getCompletions = async (files, prevCharacter = null) => {
  let completions = [];
  let seen = new Set();
  for (const file of files) {
    completions = completions.concat(
      await _getCompletions(file.file, file.namespace, seen)
    );
  }
  if (prevCharacter === "@") {
    return completions.filter(c => c.type === "survey");
  }
  return completions.filter(c => c.type !== "survey");
};

/**
 * Recursive function for getCompletions.
 * @param file The path of the file to search.
 * @param seen A set of strings we already have as completions.
 * @param s The relative survey namespace of the file.
 */
export const _getCompletions = async (
  file,
  initialNamespace = [],
  seen = new Set(),
  s = []
) => {
  const namespace = [...s];
  const liner = new LineByLine(file);
  let line: Buffer | false = null;
  let completions: { name: string; type: string; namespace: string[] }[] = [];
  while ((line = liner.next())) {
    // Find more inputs
    const relativeNamespace = getRelativeNamespace(initialNamespace, [
      ...namespace
    ]);
    const text = line.toString("utf-8");
    const inputMatch = text.match(inputReg);
    if (inputMatch) {
      const [, relativePath] = inputMatch;
      const fullPath = join(dirname(file), relativePath.replace(/\"/g, ""));
      const fullPathWithExt = extname(fullPath) ? fullPath : `${fullPath}.th`;

      const moreCompletions = await _getCompletions(
        fullPathWithExt,
        initialNamespace,
        seen,
        namespace
      );
      completions = completions.concat(...moreCompletions);
      continue;
    }

    // Find any names
    const nameMatch = text.match(nameReg);
    if (nameMatch) {
      const [, type, name] = nameMatch;
      const key = `${type}~${name}~${relativeNamespace.join(".")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      completions.push({
        name,
        type,
        namespace: relativeNamespace
      });
      continue;
    }

    // Set current survey path
    const surveyMatch = text.match(surveyReg);
    if (surveyMatch) {
      const [, surveyName] = surveyMatch;
      namespace.push(surveyName);
      const key = `survey~${surveyName}~${getRelativeNamespace(
        initialNamespace,
        [...namespace]
      ).join(".")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      completions.push({
        name: surveyName,
        type: "survey",
        namespace: getRelativeNamespace(initialNamespace, [...namespace])
      });
      continue;
    }
    const endSurveyMatch = text.match(endSurveyReg);
    if (endSurveyMatch) {
      namespace.pop();
    }
  }
  return completions;
};

/**
 * Get the survey namespace at the cursor location. To generate correct
 * relative namespace paths from autocomplete suggestsions.
 * @param file The file the cursor is in.
 * @param lineNo The line number in the file.
 */
export const getCurrentNamespace = (file, lineNo) => {
  const liner = new LineByLine(file);
  let line: Buffer | false = null;
  const survey = [];
  let i = 0;
  while ((line = liner.next())) {
    const text = line.toString("utf-8");
    const surveyMatch = text.match(surveyReg);
    if (surveyMatch) {
      const [, surveyName] = surveyMatch;
      survey.push(surveyName);
      continue;
    }
    if (i === lineNo) return survey;
    const endSurveyMatch = text.match(endSurveyReg);
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
export const getRelativeNamespace = (a: string[], b: string[]) => {
  if (a.length > b.length) return b;
  let i: number;
  for (i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return b;
  }
  return b.slice(i);
};

/**
 * Generate azzzzzzzzzz
 * @param files A list of files to search.
 */
export const getIncludes = files => {
  let includes: Map<
    string,
    { file: string; namespace: string[] }[]
  > = new Map();
  for (const file of files) {
    const namespace = [];
    const liner = new LineByLine(file.path);
    let line: Buffer | false = null;
    let lineNo = 0;
    while ((line = liner.next())) {
      // Find more inputs
      const text = line.toString("utf-8");
      const inputMatch = text.match(inputReg);
      if (inputMatch) {
        const namespace = getCurrentNamespace(file.path, lineNo);
        const [, relativePath] = inputMatch;
        const fullPath = join(
          dirname(file.path),
          relativePath.replace(/\"/g, "")
        );
        const fullPathWithExt = extname(fullPath) ? fullPath : `${fullPath}.th`;
        includes.set(fullPathWithExt, [
          ...(includes.get(fullPathWithExt) || []),
          { file: file.path, namespace }
        ]);
      }
      // Set current survey path
      const surveyMatch = text.match(surveyReg);
      if (surveyMatch) {
        const [, surveyName] = surveyMatch;
        namespace.push(surveyName);
      }
      const endSurveyMatch = text.match(endSurveyReg);
      if (endSurveyMatch) {
        namespace.pop();
      }

      lineNo = lineNo + 1;
    }
  }
  return includes;
};
