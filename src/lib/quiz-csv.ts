/**
 * Turns a CSV produced elsewhere into quiz question drafts.
 *
 * Supported formats:
 * - Simple MCQ format:
 *   question no, question, option a, option b, option c, option d
 * - Advanced Multi-Type format:
 *   Q_No, Type, Question_English, Question_Hinglish, Option_A, Option_B, Option_C, Option_D, Correct_Option, Correct_Answer, Marks
 */

import type { QuestionDraft } from "@/components/ums/quiz-editor";

export type CsvParseResult = {
  questions: QuestionDraft[];
  /** Human-readable problems, e.g. a row with a missing question text. */
  warnings: string[];
  /** Rows that were skipped entirely. */
  skipped: number;
};

/** Lowercased, punctuation-stripped header cell -> canonical column name. */
const normalizeHeader = (cell: string) =>
  cell
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Splits CSV text into rows of cells, honouring quoted fields that contain
 * commas, newlines or escaped double quotes (`""`).
 */
export function parseCsvRows(text: string): string[][] {
  // Strip a UTF-8 BOM so the first header does not become "ï»¿question".
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      if (cell === "") {
        inQuotes = true;
      } else {
        cell += char;
      }
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\r") {
      // Swallow CR; the \n that follows ends the row.
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  // Flush the last cell/row when the file has no trailing newline.
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // Drop trailing blank lines produced by a final newline.
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c.trim() === "")) {
    rows.pop();
  }

  return rows;
}

type ColumnMapping = {
  typeCol?: number;
  promptCol?: number;
  englishPromptCol?: number;
  hinglishPromptCol?: number;
  optionCols: number[];
  correctOptionCol?: number;
  correctAnswerCol?: number;
  marksCol?: number;
};

function resolveColumns(header: string[] | null, rowSample?: string[]): ColumnMapping {
  if (header) {
    const map = new Map<string, number>();
    header.forEach((cell, index) => {
      const name = normalizeHeader(cell);
      if (!map.has(name)) map.set(name, index);
    });

    const typeCol =
      map.get("type") ?? map.get("question type") ?? map.get("q type");

    const englishPromptCol =
      map.get("question english") ??
      map.get("english") ??
      map.get("question en");

    const hinglishPromptCol =
      map.get("question hinglish") ??
      map.get("hinglish") ??
      map.get("question hi") ??
      map.get("translation");

    const promptCol =
      map.get("question") ??
      map.get("prompt") ??
      map.get("question text") ??
      map.get("question prompt");

    const optionCols: number[] = [];
    const standardOptionNames = [
      "option a",
      "option b",
      "option c",
      "option d",
      "option e",
      "option f",
    ];
    for (const opt of standardOptionNames) {
      const idx = map.get(opt);
      if (idx !== undefined) optionCols.push(idx);
    }

    if (optionCols.length === 0) {
      const numericOptionNames = [
        "option 1",
        "option 2",
        "option 3",
        "option 4",
      ];
      for (const opt of numericOptionNames) {
        const idx = map.get(opt);
        if (idx !== undefined) optionCols.push(idx);
      }
    }

    // Fallback: look for any column matching "option" or "choice"
    if (optionCols.length === 0) {
      header.forEach((cell, index) => {
        const norm = normalizeHeader(cell);
        if (norm.startsWith("option") || norm.startsWith("choice")) {
          optionCols.push(index);
        }
      });
    }

    const correctOptionCol =
      map.get("correct option") ??
      map.get("correct choice") ??
      map.get("correct opt") ??
      map.get("answer key");

    const correctAnswerCol =
      map.get("correct answer") ??
      map.get("accepted answer") ??
      map.get("accepted answers") ??
      map.get("answer") ??
      map.get("solution");

    const marksCol =
      map.get("marks") ??
      map.get("points") ??
      map.get("score") ??
      map.get("weight");

    return {
      typeCol,
      promptCol,
      englishPromptCol,
      hinglishPromptCol,
      optionCols,
      correctOptionCol,
      correctAnswerCol,
      marksCol,
    };
  }

  // Positional fallback when no header row is present
  const colCount = rowSample ? rowSample.length : 5;
  if (colCount >= 10) {
    return {
      typeCol: 1,
      englishPromptCol: 2,
      hinglishPromptCol: 3,
      optionCols: [4, 5, 6, 7],
      correctOptionCol: 8,
      correctAnswerCol: 9,
      marksCol: 10,
    };
  }

  return {
    promptCol: 0,
    optionCols: [1, 2, 3, 4],
  };
}

const cell = (row: string[], index: number | undefined) =>
  index === undefined ? "" : (row[index] ?? "").trim();

export function questionsFromCsv(text: string, makeKey: () => string): CsvParseResult {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    return { questions: [], warnings: ["That file looks empty."], skipped: 0 };
  }

  // A header row is any first row whose first or second cell normalizes to known column names
  const first = rows[0].map(normalizeHeader);
  const looksLikeHeader =
    first.includes("question") ||
    first.includes("question english") ||
    first.includes("question no") ||
    first.includes("q no") ||
    first.includes("type") ||
    first.includes("option a") ||
    first.includes("prompt");

  const header = looksLikeHeader ? rows[0] : null;
  const dataRows = looksLikeHeader ? rows.slice(1) : rows;
  const mapping = resolveColumns(header, dataRows[0]);

  const questions: QuestionDraft[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  dataRows.forEach((row, index) => {
    // Line number as seen in a text editor, for warnings.
    const line = looksLikeHeader ? index + 2 : index + 1;

    const english = cell(row, mapping.englishPromptCol);
    const hinglish = cell(row, mapping.hinglishPromptCol);
    const genericPrompt = cell(row, mapping.promptCol);

    let prompt = genericPrompt;
    if (english && hinglish) {
      prompt = `${english}\n\n(${hinglish})`;
    } else if (english) {
      prompt = english;
    } else if (hinglish) {
      prompt = hinglish;
    }

    const typeRaw = cell(row, mapping.typeCol).toLowerCase();
    const optionsRaw = mapping.optionCols
      .map((colIdx) => cell(row, colIdx))
      .filter((t) => t !== "");

    const correctAnsRaw = cell(row, mapping.correctAnswerCol);
    const correctOptRaw = cell(row, mapping.correctOptionCol);

    // Skip totally blank rows
    if (
      !prompt &&
      optionsRaw.length === 0 &&
      !correctAnsRaw &&
      !correctOptRaw
    ) {
      skipped++;
      return;
    }

    if (!prompt) {
      skipped++;
      warnings.push(`Row ${line} skipped: the question text is empty.`);
      return;
    }

    // Determine type: free_text, multiple_choice, or single_choice
    const isExplicitFreeText =
      typeRaw.includes("free") ||
      typeRaw.includes("text") ||
      typeRaw.includes("short");

    const isExplicitMulti =
      typeRaw.includes("multi") ||
      typeRaw.includes("multiple") ||
      typeRaw.includes("check");

    const isExplicitSingle =
      typeRaw.includes("mcq") ||
      typeRaw.includes("single") ||
      typeRaw.includes("choice") ||
      typeRaw.includes("radio");

    const isFreeText =
      isExplicitFreeText ||
      (!isExplicitSingle && !isExplicitMulti && optionsRaw.length === 0 && Boolean(correctAnsRaw || correctOptRaw));

    // Marks/Points
    const marksRaw = cell(row, mapping.marksCol);
    const points = marksRaw ? Math.max(1, parseInt(marksRaw, 10) || 1) : 1;

    if (isFreeText) {
      const rawAnswer = correctAnsRaw || correctOptRaw;
      let accepted: string[] = [];
      if (rawAnswer) {
        if (rawAnswer.includes(";") || rawAnswer.includes("\n") || rawAnswer.includes("|")) {
          accepted = rawAnswer
            .split(/[;\n|]/)
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          accepted = [rawAnswer.trim()];
        }
      }

      questions.push({
        key: makeKey(),
        type: "free_text",
        prompt,
        options: [],
        correctAnswer: accepted,
        points,
      });
    } else {
      if (optionsRaw.length < 2) {
        warnings.push(
          `Row ${line} ("${prompt.slice(0, 40)}${prompt.length > 40 ? "…" : ""}") has only ${optionsRaw.length} option — an MCQ needs at least two.`,
        );
      }

      const optionObjs = optionsRaw.map((text) => ({ id: makeKey(), text }));
      const correctAnswer: string[] = [];
      let detectedMulti = false;

      const correctOptClean = correctOptRaw.toUpperCase().trim();
      // Support comma-separated letters for multi-select e.g. "A,C"
      const letterParts = correctOptClean.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      if (letterParts.length > 1) {
        detectedMulti = true;
        for (const part of letterParts) {
          const letterIndex = ["A", "B", "C", "D", "E", "F"].indexOf(part);
          if (letterIndex !== -1 && optionObjs[letterIndex]) {
            correctAnswer.push(optionObjs[letterIndex].id);
          }
        }
      } else {
        const letterIndex = ["A", "B", "C", "D", "E", "F"].indexOf(correctOptClean);
        if (letterIndex !== -1 && optionObjs[letterIndex]) {
          correctAnswer.push(optionObjs[letterIndex].id);
        } else {
          const numIndex = parseInt(correctOptClean, 10);
          if (!isNaN(numIndex) && numIndex >= 1 && optionObjs[numIndex - 1]) {
            correctAnswer.push(optionObjs[numIndex - 1].id);
          } else if (correctAnsRaw) {
            const matched = optionObjs.find(
              (o) => o.text.trim().toLowerCase() === correctAnsRaw.trim().toLowerCase(),
            );
            if (matched) {
              correctAnswer.push(matched.id);
            }
          }
        }
      }

      // Infer type: multi if comma-separated correct options, else single
      const questionType: "single_choice" | "multiple_choice" =
        detectedMulti || isExplicitMulti ? "multiple_choice" : "single_choice";

      questions.push({
        key: makeKey(),
        type: questionType,
        prompt,
        options: optionObjs,
        correctAnswer,
        points,
      });
    }
  });

  if (questions.length === 0 && warnings.length === 0) {
    warnings.push(
      "No questions found. Make sure your CSV has question text and valid columns.",
    );
  }

  return { questions, warnings, skipped };
}
