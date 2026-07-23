import * as pdfjsLib from 'pdfjs-dist';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
  ShadingType,
  BorderStyle
} from 'docx';

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 2, color: 'AAAAAA' };
const CELL_BORDERS = { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER };
// Lines at or above this size are treated as headings both for block
// segmentation (a heading always starts its own paragraph) and for choosing
// a Word heading style — kept as one constant so the two stay in sync.
const HEADING_TIER_MIN_SIZE = 14;

// A leaked HTML entity ("&bull;") is a common PDF-generation artifact — some
// HTML-to-PDF pipelines forget to render it as a glyph and leave the literal
// text in the content stream, which pdf.js's text extraction faithfully
// reproduces verbatim. Genuine Unicode bullet glyphs are recognized too.
// Plain "-"/"*" are deliberately excluded — too ambiguous with hyphens and
// negative numbers in ordinary body text to treat as list markers safely.
const BULLET_MARKER_RE = /^(&bull;|[•●▪‣∙·◦])\s*/i;

function groupIntoLines(items, rowTolerance) {
  const lines = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = item.transform[5];
    const size = Math.hypot(item.transform[1], item.transform[3]) || item.height || 10;
    let line = lines.find((l) => Math.abs(l.y - y) <= rowTolerance);
    if (!line) {
      line = { y, size, words: [] };
      lines.push(line);
    }
    line.size = Math.max(line.size, size);
    line.words.push({ x: item.transform[4], text: item.str, width: item.width || item.str.length * size * 0.5 });
  }
  lines.sort((a, b) => b.y - a.y);
  lines.forEach((l) => l.words.sort((a, b) => a.x - b.x));
  return lines;
}

// Merges words within a line into cells wherever the horizontal gap is
// small (normal word spacing); a gap at or above columnGapThreshold starts a
// new cell — the same technique pdf-to-xlsx.js uses to turn a row of glyphs
// into table columns.
function clusterCells(words, columnGapThreshold) {
  const cells = [];
  let current = null;
  for (const w of words) {
    if (current && w.x - current.endX < columnGapThreshold) {
      current.text += w.text;
      current.endX = w.x + w.width;
    } else {
      if (current) cells.push(current);
      current = { x: w.x, text: w.text, endX: w.x + w.width };
    }
  }
  if (current) cells.push(current);
  return cells;
}

// A block "looks like a table" when most of its lines have multiple
// columns — a conservative 60% bar, chosen so an ordinary paragraph that
// happens to have one widely-spaced line isn't misread as a table.
function isTableBlock(lines) {
  if (lines.length < 2) return false;
  const multiCellLines = lines.filter((l) => l.cells.length >= 2);
  return multiCellLines.length >= 2 && multiCellLines.length / lines.length >= 0.6;
}

// Aligns every line's cells into a shared grid: the line with the most
// cells becomes the column-position reference; other lines match their
// cells to the nearest reference column (index-aligned when counts match,
// nearest-X greedy match otherwise). Handles the common real-world case of
// an occasional merged or empty cell; genuinely irregular tables (row-
// spanning cells, nested tables) are not reliably reconstructed — the same
// "simple, grid-like tables" limitation pdf-to-xlsx.js already documents.
function buildTableGrid(lines) {
  const reference = lines.reduce((best, l) => (l.cells.length > best.cells.length ? l : best), lines[0]);
  const anchors = reference.cells.map((c) => c.x);

  return lines.map((line) => {
    const row = new Array(anchors.length).fill('');
    if (line.cells.length === anchors.length) {
      line.cells.forEach((cell, i) => {
        row[i] = cell.text.trim();
      });
      return row;
    }
    for (const cell of line.cells) {
      let bestIdx = -1;
      let bestDist = Infinity;
      anchors.forEach((ax, i) => {
        if (row[i]) return; // column already claimed by another cell on this row
        const dist = Math.abs(cell.x - ax);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      });
      if (bestIdx !== -1) row[bestIdx] = cell.text.trim();
    }
    return row;
  });
}

function tableFromGrid(grid) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: grid.map(
      (rowCells, rowIndex) =>
        new TableRow({
          children: rowCells.map(
            (text) =>
              new TableCell({
                borders: CELL_BORDERS,
                shading: rowIndex === 0 ? { fill: 'D9D9D9', type: ShadingType.CLEAR } : undefined,
                children: [new Paragraph({ children: [new TextRun({ text, bold: rowIndex === 0, size: 20 })] })]
              })
          )
        })
    )
  });
}

function headingLevelFor(size) {
  if (size >= 18) return HeadingLevel.HEADING_1;
  if (size >= HEADING_TIER_MIN_SIZE) return HeadingLevel.HEADING_2;
  return undefined;
}

function lineText(line) {
  return line.words
    .map((w) => w.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function plainParagraph(text, maxSize) {
  const heading = headingLevelFor(maxSize);
  if (heading) {
    return new Paragraph({ heading, children: [new TextRun({ text })], spacing: { after: 160 } });
  }
  return new Paragraph({ children: [new TextRun({ text, size: 22 })], spacing: { after: 160 } });
}

function bulletParagraph(text) {
  return new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text, size: 22 })], spacing: { after: 100 } });
}

// Non-table blocks: consecutive non-bullet lines merge into one flowing
// paragraph (same "join by normal line spacing" behavior as before), but a
// line starting with a bullet marker is always flushed as its own bulleted
// paragraph — list items are usually spaced like normal paragraph lines, so
// leaving them to merge into the block above/below would collapse an entire
// bullet list into one run-on paragraph.
function paragraphsFromBlock(lines) {
  const out = [];
  let buffer = [];

  function flushBuffer() {
    if (!buffer.length) return;
    const text = buffer
      .map(lineText)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const maxSize = Math.max(...buffer.map((l) => l.size));
    buffer = [];
    if (text) out.push(plainParagraph(text, maxSize));
  }

  for (const line of lines) {
    const text = lineText(line);
    const bulletMatch = text.match(BULLET_MARKER_RE);
    if (bulletMatch) {
      flushBuffer();
      const stripped = text.slice(bulletMatch[0].length).trim();
      if (stripped) out.push(bulletParagraph(stripped));
    } else {
      buffer.push(line);
    }
  }
  flushBuffer();
  return out;
}

// Text-based reconstruction: detects table-like regions (row/column
// clustering, same heuristic family as pdf-to-xlsx.js) and renders them as
// real Word tables, applies heading styles by font-size tier, and turns
// bullet-marker lines into real bulleted paragraphs. This preserves reading
// order and structure much closer to the source than plain text, but it is
// still reconstruction, not a pixel clone: inline bold within body text
// isn't detected (pdf.js's text extraction doesn't reliably expose per-run
// font weight), and irregular/merged-cell tables may not align perfectly —
// documented in ROADMAP.md, the same fidelity tradeoff every non-ML
// PDF-to-Word tool makes.
export async function pdfToDocx(buf, { rowTolerance = 3, columnGapThreshold = 12 } = {}) {
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const children = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = groupIntoLines(content.items, rowTolerance);
    lines.forEach((l) => {
      l.cells = clusterCells(l.words, columnGapThreshold);
    });

    // Segment into blocks separated by a larger-than-normal vertical gap OR
    // a heading-sized line (headings always get their own block regardless
    // of gap size — a heading immediately followed by body/table text at
    // normal line spacing is still a real paragraph break). The gap
    // threshold alone isn't reliable for this: real documents' table row
    // spacing is often *tighter*, proportionally, than the gap after a
    // heading, so a single relative cutoff that works for one misclassifies
    // the other — headings need their own explicit rule.
    const blocks = [];
    let current = [];
    let lastY = null;
    let lastSize = null;
    for (const line of lines) {
      const isHeadingLine = line.size >= HEADING_TIER_MIN_SIZE;
      const prevWasHeadingLine = lastSize !== null && lastSize >= HEADING_TIER_MIN_SIZE;
      const bigGap = lastY !== null && Math.abs(lastY - line.y) > (lastSize || line.size || 10) * 2;
      if (lastY !== null && (bigGap || isHeadingLine || prevWasHeadingLine)) {
        if (current.length) blocks.push(current);
        current = [];
      }
      current.push(line);
      lastY = line.y;
      lastSize = line.size;
    }
    if (current.length) blocks.push(current);

    for (const block of blocks) {
      if (isTableBlock(block)) {
        children.push(tableFromGrid(buildTableGrid(block)));
        children.push(new Paragraph({ children: [], spacing: { after: 80 } }));
      } else {
        children.push(...paragraphsFromBlock(block));
      }
    }

    if (i < pdf.numPages) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }
  await pdf.destroy();

  const doc = new Document({ sections: [{ children }] });
  // toBlob (not toBuffer) is the browser/worker-safe output path for `docx`.
  return Packer.toBlob(doc);
}
