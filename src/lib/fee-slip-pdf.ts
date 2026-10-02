import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Computer-generated fee slip. Rendered server-side with pdf-lib so no headless
 * browser is needed and the student can download exactly what the admin recorded.
 *
 * The two authorised signatures are real images held in the private `signatures`
 * bucket; when one is missing the slip still generates, with a ruled signature
 * line and the printed name instead of an image.
 */

export const INSTITUTE = {
  name: "Rising Sun Tech Institute",
  address: "Plot# 1831/A, Majeed Colony sector 2, Landhi Town, Karachi",
  phone: "03460136106",
  email: "therisingsuntech@gmail.com",
} as const;

export const SIGNATORIES = [
  { key: "shuja-uz-zaman.png", name: "Shuja Uz Zaman", role: "Principal" },
  {
    key: "muhammad-hamza-sheikh.png",
    name: "Muhammad Hamza Sheikh",
    role: "Administrator",
  },
] as const;

export type SlipDetails = {
  slipReference: string;
  issuedOn: Date;
  paidOn: Date;
  studentName: string;
  studentEmail: string;
  rollNumber: string;
  courseName: string;
  courseCode: string;
  period: string;
  originalFee: number;
  amountPaid: number;
  /** Why the paid amount differs from the original fee. */
  adjustmentReason: string | null;
  currency: string;
  method: string;
  reference: string | null;
  notes: string | null;
  /** PNG bytes for each signatory key, when one has been uploaded. */
  signatures: Record<string, Uint8Array | null>;
};

// The site's orange theme (src/app/global.css), oklch -> sRGB.
const INK = hex("180f0d"); // --card-foreground
const MUTED = hex("685a54"); // --muted-foreground
const RULE = hex("e5e0dc"); // --border
const BRAND = hex("ef5010"); // --primary
const BRAND_DEEP = hex("a01c00"); // --chart-5
const PAPER = rgb(1, 1, 1);
const BAND = hex("faebe3"); // --secondary
const SOFT = hex("fee9d6"); // --accent
const GOOD = hex("15803d");
const ON_BRAND = hex("fdfbfa"); // --primary-foreground

function hex(v: string) {
  return rgb(
    parseInt(v.slice(0, 2), 16) / 255,
    parseInt(v.slice(2, 4), 16) / 255,
    parseInt(v.slice(4, 6), 16) / 255,
  );
}

const money = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Truncates to fit a measured pixel width instead of guessing at character counts. */
const fitText = (text: string, font: PDFFont, size: number, maxWidth: number) => {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
};

/** Wraps text to a measured width so long course names are shown in full. */
const wrapText = (
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const longDate = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export async function generateFeeSlip(details: SlipDetails): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const balanceDue = Math.max(0, details.originalFee - details.amountPaid);
  const overpaid = Math.max(0, details.amountPaid - details.originalFee);
  const isPartial = balanceDue > 0;

  page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: PAPER });

  header(page, bold, regular);
  let y = title(page, bold, regular, details);

  y = metaPanel(page, bold, regular, details, y);
  y = feeTable(page, bold, regular, details, { y, balanceDue, overpaid, isPartial });

  y = notesBlock(page, regular, details, y);
  y = statusBanner(page, bold, regular, y, { isPartial, balanceDue, currency: details.currency, reason: details.adjustmentReason });
  await signatures(doc, page, bold, regular, italic, details, y);

  footer(page, regular, details);

  return doc.save();
}

function header(page: PDFPage, bold: PDFFont, regular: PDFFont) {
  page.drawRectangle({ x: 0, y: 727, width: 595.28, height: 114.89, color: BAND });
  page.drawRectangle({ x: 0, y: 723, width: 595.28, height: 3, color: BRAND });

  page.drawText(INSTITUTE.name, {
    x: 40,
    y: 800,
    size: 17,
    font: bold,
    color: INK,
  });
  // The address gets its own line; contact details share the next one.
  wrapText(INSTITUTE.address, regular, 9, 470).forEach((line, i) => {
    page.drawText(line, { x: 40, y: 787 - i * 11, size: 9, font: regular, color: MUTED });
  });
  page.drawText(`Phone: ${INSTITUTE.phone}   ·   Email: ${INSTITUTE.email}`, {
    x: 40,
    y: 764,
    size: 9,
    font: regular,
    color: MUTED,
  });

  const badge = "FEE PAYMENT SLIP";
  page.drawText(badge, {
    x: 555.28 - 40 - bold.widthOfTextAtSize(badge, 12),
    y: 800,
    size: 12,
    font: bold,
    color: BRAND,
  });
}

function title(page: PDFPage, bold: PDFFont, regular: PDFFont, d: SlipDetails) {
  page.drawText("FEE PAYMENT SLIP", {
    x: 40,
    y: 695,
    size: 22,
    font: bold,
    color: INK,
  });
  page.drawText(
    `This is to certify that the fee for ${d.period} has been received.`,
    { x: 40, y: 677, size: 10, font: regular, color: MUTED },
  );

  const right = [
    ["Receipt No.", d.slipReference],
    ["Issued", longDate(d.issuedOn)],
    ["Paid on", longDate(d.paidOn)],
  ];
  right.forEach(([label, value], i) => {
    const y = 695 - i * 13;
    page.drawText(String(label), { x: 400, y, size: 9, font: regular, color: MUTED });
    page.drawText(String(value), {
      x: 452,
      y,
      size: 9,
      font: bold,
      color: INK,
    });
  });
  return 652;
}

function metaPanel(page: PDFPage, bold: PDFFont, regular: PDFFont, d: SlipDetails, top: number) {
  const height = 96;
  const topY = top - height;

  page.drawRectangle({
    x: 40,
    y: topY,
    width: 515.28,
    height,
    color: BAND,
    borderColor: RULE,
    borderWidth: 0.5,
  });

  // Row 1 — student and roll number side by side.
  const fields: [string, string, number, number][] = [
    ["STUDENT", d.studentName, 52, 230],
    ["ROLL NUMBER", d.rollNumber, 330, 200],
  ];
  for (const [label, value, x, maxWidth] of fields) {
    page.drawText(label, { x, y: topY + 80, size: 7, font: bold, color: MUTED });
    page.drawText(fitText(value, bold, 10, maxWidth), {
      x,
      y: topY + 65,
      size: 10,
      font: bold,
      color: INK,
    });
  }
  page.drawText(d.studentEmail, { x: 52, y: topY + 51, size: 8, font: regular, color: MUTED });

  // Row 2 — the course name in full, wrapped across the panel.
  page.drawText("COURSE", { x: 52, y: topY + 35, size: 7, font: bold, color: MUTED });
  const courseLines = wrapText(`${d.courseCode} — ${d.courseName}`, bold, 10, 480).slice(0, 3);
  courseLines.forEach((line, i) => {
    page.drawText(line, {
      x: 52,
      y: topY + 20 - i * 12,
      size: 10,
      font: bold,
      color: INK,
    });
  });

  return topY - 22;
}

type Row = {
  label: string;
  /** Amounts are right-aligned in the money column; text wraps in the middle. */
  amount?: string;
  text?: string;
  emphasise?: boolean;
};

function feeTable(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  d: SlipDetails,
  ctx: { y: number; balanceDue: number; overpaid: number; isPartial: boolean },
) {
  let y = ctx.y;

  const rows: Row[] = [
    { label: "Course", text: `${d.courseCode} — ${d.courseName}` },
    { label: "Billing period", text: d.period },
    { label: "Original fee", amount: money(d.originalFee, d.currency) },
  ];
  if (d.adjustmentReason) {
    rows.push({ label: "Reason for reduced fee", text: d.adjustmentReason });
  }
  rows.push({ label: "Amount paid", amount: money(d.amountPaid, d.currency), emphasise: true });
  if (ctx.balanceDue > 0) {
    rows.push({ label: "Balance remaining", amount: money(ctx.balanceDue, d.currency) });
  }
  if (ctx.overpaid > 0) {
    rows.push({ label: "Advance / overpaid", amount: money(ctx.overpaid, d.currency) });
  }
  rows.push({ label: "Payment method", text: d.method.replace(/_/g, " ") });
  if (d.reference) rows.push({ label: "Reference / receipt", text: d.reference });

  const LABEL_X = 50;
  const TEXT_X = 178;
  const TEXT_W = 255;
  const AMOUNT_RIGHT = 545;

  // Header band
  page.drawRectangle({ x: 40, y: y - 20, width: 515.28, height: 20, color: BRAND });
  page.drawText("DESCRIPTION", { x: LABEL_X, y: y - 14, size: 8, font: bold, color: ON_BRAND });
  page.drawText("AMOUNT", {
    x: AMOUNT_RIGHT - bold.widthOfTextAtSize("AMOUNT", 8),
    y: y - 14,
    size: 8,
    font: bold,
    color: ON_BRAND,
  });
  y -= 20;

  rows.forEach((row, i) => {
    const bodyFont = row.emphasise ? bold : regular;
    const bodySize = row.emphasise ? 10.5 : 9.5;
    const textLines = row.text
      ? wrapText(row.text, bodyFont, bodySize, TEXT_W)
      : [];

    const h = Math.max(22, 12 + textLines.length * 12);

    if (i % 2 === 1) {
      page.drawRectangle({ x: 40, y: y - h, width: 515.28, height: h, color: BAND });
    }

    page.drawText(fitText(row.label, regular, 9.5, 120), {
      x: LABEL_X,
      y: y - 15,
      size: 9.5,
      font: regular,
      color: INK,
    });

    textLines.forEach((line, li) => {
      page.drawText(line, {
        x: TEXT_X,
        y: y - 15 - li * 12,
        size: bodySize,
        font: bodyFont,
        color: INK,
      });
    });

    if (row.amount) {
      page.drawText(row.amount, {
        x: AMOUNT_RIGHT - bodyFont.widthOfTextAtSize(row.amount, bodySize),
        y: y - 15,
        size: bodySize,
        font: bodyFont,
        color: row.emphasise ? BRAND : INK,
      });
    }

    page.drawLine({
      start: { x: 40, y: y - h },
      end: { x: 555.28, y: y - h },
      thickness: 0.4,
      color: RULE,
    });
    y -= h;
  });

  // Total
  const totalText = money(d.amountPaid, d.currency);
  page.drawRectangle({ x: 40, y: y - 26, width: 515.28, height: 26, color: SOFT });
  page.drawText("TOTAL PAID", { x: LABEL_X, y: y - 17, size: 10, font: bold, color: INK });
  page.drawText(totalText, {
    x: AMOUNT_RIGHT - bold.widthOfTextAtSize(totalText, 12),
    y: y - 17.5,
    size: 12,
    font: bold,
    color: BRAND,
  });

  return y - 40;
}

function notesBlock(page: PDFPage, regular: PDFFont, d: SlipDetails, y: number) {
  if (!d.notes) return y;
  const text = d.notes.length > 150 ? `${d.notes.slice(0, 150)}…` : d.notes;
  page.drawText("Note", { x: 40, y, size: 8, font: regular, color: MUTED });
  page.drawText(text, { x: 40, y: y - 13, size: 9.5, font: regular, color: INK });
  return y - 34;
}

function statusBanner(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  y: number,
  ctx: {
    isPartial: boolean;
    balanceDue: number;
    currency: string;
    reason: string | null;
  },
) {
  const settled = !ctx.isPartial;
  const color = settled ? GOOD : BRAND_DEEP;
  const fill = settled ? hex("f4faf5") : SOFT;
  const message = settled
    ? "PAID IN FULL"
    : ctx.reason
      ? `PAID — REDUCED: ${ctx.reason.toUpperCase()}`
      : `PARTIAL PAYMENT — ${money(ctx.balanceDue, ctx.currency)} REMAINING`;

  page.drawRectangle({
    x: 40,
    y: y - 26,
    width: 515.28,
    height: 26,
    color: fill,
    borderColor: color,
    borderWidth: 0.8,
  });
  const width = bold.widthOfTextAtSize(message, 10);
  page.drawText(fitText(message, bold, 10, 495), {
    x: 40 + (515.28 - width) / 2,
    y: y - 17,
    size: 10,
    font: bold,
    color,
  });
  return y - 46;
}

async function signatures(
  doc: PDFDocument,
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  italic: PDFFont,
  d: SlipDetails,
  y: number,
) {
  const boxWidth = 190;
  const gap = 45;
  const totalWidth = boxWidth * SIGNATORIES.length + gap * (SIGNATORIES.length - 1);
  let x = (page.getWidth() - totalWidth) / 2;
  const baseline = y - 46; // where the signature line is drawn

  for (const slot of SIGNATORIES) {
    const png = d.signatures[slot.key] ?? null;
    let drewImage = false;

    if (png) {
      try {
        const embedded = await doc.embedPng(png);
        const dims = embedded.scale(0.42);
        // Keep the signature inside its box and never taller than the space above
        // the ruled line, so a tall or wide image cannot break the layout.
        const maxW = boxWidth - 16;
        const maxH = 40;
        const scale = Math.min(maxW / dims.width, maxH / dims.height, 1);
        const w = dims.width * scale;
        const h = dims.height * scale;
        page.drawImage(embedded, {
          x: x + (boxWidth - w) / 2,
          y: baseline - h - 4,
          width: w,
          height: h,
        });
        drewImage = true;
      } catch {
        drewImage = false;
      }
    }

    if (!drewImage) {
      // No signature image uploaded yet — leave the ruled line with the printed
      // name so the slip is still valid rather than blank.
      page.drawText("(signature on file)", {
        x: x + 14,
        y: baseline - 16,
        size: 8,
        font: italic,
        color: MUTED,
      });
    }

    page.drawLine({
      start: { x, y: baseline },
      end: { x: x + boxWidth, y: baseline },
      thickness: 0.8,
      color: INK,
    });
    page.drawText(slot.name, {
      x,
      y: baseline - 14,
      size: 9.5,
      font: bold,
      color: INK,
    });
    page.drawText(slot.role, {
      x,
      y: baseline - 25,
      size: 8,
      font: regular,
      color: MUTED,
    });

    x += boxWidth + gap;
  }
}

function footer(page: PDFPage, regular: PDFFont, d: SlipDetails) {
  page.drawLine({
    start: { x: 40, y: 52 },
    end: { x: 555.28, y: 52 },
    thickness: 0.5,
    color: RULE,
  });
  page.drawText(
    "This is a computer-generated slip and does not require a physical signature.",
    { x: 40, y: 38, size: 7.5, font: regular, color: MUTED },
  );
  page.drawText(d.slipReference, { x: 470, y: 38, size: 7.5, font: regular, color: MUTED });
}
