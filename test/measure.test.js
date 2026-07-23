import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { polygonArea, distance, stampMeasurements } from '../src/engines/pdf/measure.js';

describe('measure math', () => {
  it('computes distance between two points', () => {
    expect(distance([0, 0], [3, 4])).toBe(5);
  });

  it('computes the area of a simple square via the shoelace formula', () => {
    const square = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10]
    ];
    expect(polygonArea(square)).toBe(100);
  });
});

describe('measure stamping', () => {
  it('stamps a distance measurement onto a PDF without throwing', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 300]);
    const bytes = await doc.save();

    const stamped = await stampMeasurements(bytes, [
      { pageIndex: 0, points: [[10, 10], [100, 10]], label: '90 cm', type: 'distance' }
    ]);
    const reloaded = await PDFDocument.load(stamped);
    expect(reloaded.getPageCount()).toBe(1);
  });
});
