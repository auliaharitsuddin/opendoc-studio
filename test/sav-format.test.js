import { describe, it, expect } from 'vitest';
import { writeSav, readSav } from '../src/engines/excel-sav/sav-format.js';

describe('sav-format round-trip', () => {
  it('writes and reads back numeric and string columns', () => {
    const table = {
      columns: [{ name: 'usia' }, { name: 'nama' }, { name: 'skor' }],
      rows: [
        [25, 'Budi Santoso', 87.5],
        [30, 'Ani', 92],
        [null, 'Citra Dewi Lestari', null]
      ]
    };

    const bytes = writeSav(table);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(176); // at least bigger than the header alone

    const { columns, rows } = readSav(bytes);
    expect(columns.map((c) => c.name)).toEqual(['usia', 'nama', 'skor']);
    expect(columns[0].type).toBe('numeric');
    expect(columns[1].type).toBe('string');

    expect(rows).toHaveLength(3);
    expect(rows[0][0]).toBe(25);
    expect(rows[0][1]).toBe('Budi Santoso');
    expect(rows[0][2]).toBe(87.5);
    expect(rows[1][0]).toBe(30);
    expect(rows[2][0]).toBeNull();
    expect(rows[2][1]).toBe('Citra Dewi Lestari');
  });

  it('rejects files that are not a recognizable .sav', () => {
    const bogus = new Uint8Array(200);
    expect(() => readSav(bogus)).toThrow();
  });

  it('handles an empty dataset (zero rows)', () => {
    const table = { columns: [{ name: 'kolom1' }], rows: [] };
    const bytes = writeSav(table);
    const { columns, rows } = readSav(bytes);
    expect(columns).toHaveLength(1);
    expect(rows).toHaveLength(0);
  });
});
