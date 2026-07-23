// Parses a human page-range string ("1,3,5-7") into 0-based page indices.
// Accepted because a full drag-and-drop thumbnail reorder UI is a much larger
// build than this session's budget allows (tracked in ROADMAP.md) — a text
// range is the same input model most web PDF tools expose for this.
export function parsePageRange(input, pageCount) {
  const trimmed = (input || '').trim();
  if (!trimmed) return Array.from({ length: pageCount }, (_, i) => i);
  const indices = new Set();
  for (const part of trimmed.split(',')) {
    const piece = part.trim();
    if (!piece) continue;
    const rangeMatch = piece.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Math.max(1, parseInt(rangeMatch[1], 10));
      const end = Math.min(pageCount, parseInt(rangeMatch[2], 10));
      for (let i = start; i <= end; i += 1) indices.add(i - 1);
    } else if (/^\d+$/.test(piece)) {
      const n = parseInt(piece, 10);
      if (n >= 1 && n <= pageCount) indices.add(n - 1);
    }
  }
  return [...indices].sort((a, b) => a - b);
}
