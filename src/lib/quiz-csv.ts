/**
 * Turns a CSV produced elsewhere (e.g. by Claude) into quiz question drafts.
 *
 * The file is read with the browser FileReader and parsed here in the client, so
 * it is never uploaded, never written to the database and never leaves the
 * browser. Only the extracted text ends up in the quiz, which is saved through
 * the normal `createQuiz` action once the teacher presses save.
 *
 * Expected columns (matched case-insensitively, extra columns are ignored):
 *   question no, question, option a, option b, option c, option d
 */

import type { QuestionDraft } from "@/components/ums/quiz-editor";

export type CsvParseResult = {
  questions: QuestionDraft[];
  /** Human-readable problems, e.g. a row with a missing question text. */
  warnings: string[];
  /** Rows that were skipped entirely. */
  skipped: number;
};

const REQUIRED = ["question", "option a", "option b", "option c", "option d"] as const;

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
      // Per RFC 4180 a quote only opens a quoted field when it is the very first
      // character. Anywhere else it is an ordinary character, so an unquoted
      // cell such as  Who said "hi"?  keeps its quotes.
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

/**
 * Finds the required columns. Falls back to positional order (question, a, b, c, d)
 * when the header row is missing or does not name them.
 */
function resolveColumns(header: string[] | null) {
  if (header) {
    const map = new Map<string, number>();
    header.forEach((cell, index) => {
      const name = normalizeHeader(cell);
      if (!map.has(name)) map.set(name, index);
    });

    const indices: number[] = [];
    let missing: string | null = null;
    for (const column of REQUIRED) {
      const index = map.get(column);
      if (index === undefined) {
        missing = column;
        break;
      }
      indices.push(index);
    }

    if (!missing) return { indices };
  }

  // Positional fallback: question, option a, option b, option c, option d.
  return { indices: [0, 1, 2, 3, 4] };
}

const cell = (row: string[], index: number | undefined) =>
  index === undefined ? "" : (row[index] ?? "").trim();

export function questionsFromCsv(text: string, makeKey: () => string): CsvParseResult {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    return { questions: [], warnings: ["That file looks empty."], skipped: 0 };
  }

  // A header row is any first row whose first cell normalizes to a known column
  // name; otherwise the first row is treated as data.
  const first = rows[0].map(normalizeHeader);
  const looksLikeHeader =
    first.includes("question") ||
    first.includes("question no") ||
    first.includes("option a");

  const header = looksLikeHeader ? rows[0] : null;
  const dataRows = looksLikeHeader ? rows.slice(1) : rows;
  const { indices } = resolveColumns(header);

  const questions: QuestionDraft[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  dataRows.forEach((row, index) => {
    // Line number as seen in a text editor, for warnings.
    const line = looksLikeHeader ? index + 2 : index + 1;
    const prompt = cell(row, indices[0]);
    const options = indices.slice(1).map((i) => cell(row, i));

    if (prompt === "" && options.every((o) => o === "")) {
      skipped++;
      return;
    }

    if (prompt === "") {
      skipped++;
      warnings.push(`Row ${line} skipped: the question text is empty.`);
      return;
    }

    const filled = options.filter((o) => o !== "");
    if (filled.length < 2) {
      warnings.push(
        `Row ${line} ("${prompt.slice(0, 40)}${prompt.length > 40 ? "…" : ""}") has only ${filled.length} option — an MCQ needs at least two.`,
      );
    }

    // Options that are blank in the CSV are dropped rather than saved as empty
    // choices the student could click.
    questions.push({
      key: makeKey(),
      type: "mcq",
      prompt,
      options: options
        .filter((o) => o !== "")
        .map((text) => ({ id: makeKey(), text })),
      // Nothing can be auto-detected from these columns, so the teacher picks the
      // correct answer(s) in the editor before saving.
      correctAnswer: [],
      points: 1,
    });
  });

  if (questions.length === 0 && warnings.length === 0) {
    warnings.push(
      "No questions found. Expected columns: question no, question, option a, option b, option c, option d.",
    );
  }

  return { questions, warnings, skipped };
}
