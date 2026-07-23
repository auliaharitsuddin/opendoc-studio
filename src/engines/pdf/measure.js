import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Shoelace formula for polygon area (points in any consistent unit).
export function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export function distance([x1, y1], [x2, y2]) {
  return Math.hypot(x2 - x1, y2 - y1);
}

// measurements: [{ pageIndex, points: [[x,y], ...], label, type: 'distance'|'area' }]
// Points are already in PDF page-coordinate space (origin bottom-left, in pt).
export async function stampMeasurements(buf, measurements) {
  const doc = await PDFDocument.load(buf);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  for (const m of measurements) {
    const page = pages[m.pageIndex];
    const color = m.type === 'area' ? rgb(0.85, 0.4, 0) : rgb(0, 0.4, 0.85);

    for (let i = 0; i < m.points.length; i += 1) {
      const [x1, y1] = m.points[i];
      const isClosedShape = m.type === 'area';
      const next = m.points[(i + 1) % m.points.length];
      if (i < m.points.length - 1 || isClosedShape) {
        page.drawLine({ start: { x: x1, y: y1 }, end: { x: next[0], y: next[1] }, thickness: 1.5, color });
      }
      page.drawCircle({ x: x1, y: y1, size: 2.5, color });
    }

    const labelPoint = m.points[m.points.length - 1];
    page.drawText(m.label, {
      x: labelPoint[0] + 6,
      y: labelPoint[1] + 6,
      size: 10,
      font,
      color
    });
  }

  return doc.save();
}
