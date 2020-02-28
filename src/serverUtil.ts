import * as fs from "fs";
import { join, dirname, extname } from "path";
import * as util from "util";
import LineByLine from "n-readlines";

export const readFile = util.promisify(fs.readFile);

const inputReg = /(?:\n|^)\s*(?:input|source)\s+(\S+)/;
const nameReg = /(?:\n|^)\s*(map|scrap)\s+(\S+)/;
const surveyReg = /(?:\n|^)\s*survey\s+(\S+)/;
const endSurveyReg = /(?:\n|^)\s*endsurvey/;

export const getCompletions = async (file, prevCharacter) => {
  const completions = await _getCompletions(file);
  if (prevCharacter === "@") {
    return completions.filter(c => c.type === "survey");
  }
  return completions.filter(c => c.type !== "survey");
};

export const _getCompletions = async (file, seen = new Set(), s = []) => {
  const survey = [...s];
  const liner = new LineByLine(file);
  let line: Buffer | false = null;
  let completions: { name: string; type: string; survey: string[] }[] = [];
  while ((line = liner.next())) {
    // Find more inputs
    const text = line.toString("utf-8");
    const inputMatch = text.match(inputReg);
    if (inputMatch) {
      const [, relativePath] = inputMatch;
      const fullPath = join(dirname(file), relativePath.replace(/\"/g, ""));
      // inputs.push(extname(fullPath) ? fullPath : `${fullPath}.th`);
      const fullPathWithExt = extname(fullPath) ? fullPath : `${fullPath}.th`;

      const moreCompletions = await _getCompletions(
        fullPathWithExt,
        seen,
        survey
      );
      completions = completions.concat(...moreCompletions);
      continue;
    }

    // Find any names
    const nameMatch = text.match(nameReg);
    if (nameMatch) {
      const [, type, name] = nameMatch;
      if (seen.has(`${type}~${name}~${survey.join(".")}`)) continue;
      seen.add(`${type}~${name}~${survey.join(".")}`);
      completions.push({
        name,
        type,
        survey: [...survey]
      });
      continue;
    }

    // Set current survey path
    const surveyMatch = text.match(surveyReg);
    if (surveyMatch) {
      const [, surveyName] = surveyMatch;
      survey.push(surveyName);
      completions.push({
        name: surveyName,
        type: "survey",
        survey: [...survey]
      });
      continue;
    }
    const endSurveyMatch = text.match(endSurveyReg);
    if (endSurveyMatch) {
      survey.pop();
    }
  }
  return completions;
};

export const getCurrentSurveyPath = async (file, lineNo) => {
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

export const getRelativeSurveyPath = (a: string[], b: string[]) => {
  if (a.length > b.length) return b;
  let i: number;
  for (i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return b;
  }
  return b.slice(i);
};
