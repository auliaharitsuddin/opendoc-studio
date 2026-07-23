// Minimal, from-scratch reader/writer for the SPSS ".sav" system-file format
// (ISO-published, but documented openly and precisely by the GNU PSPP project:
// https://www.gnu.org/software/pspp/pspp-dev/html_node/System-File-Format.html).
// No JS library for this format exists, so this is a first-principles binary
// implementation. Deliberate scope limits, chosen to keep the implementation
// correct and verifiable rather than broad:
//   - Writer always emits UNCOMPRESSED ($FL2, compression=0) files. Valid and
//     universally readable, just larger than SPSS's own compressed output.
//   - Reader supports both uncompressed and "simple bytecode" compressed $FL2
//     data. It does NOT support $FL3 (ZLIB-compressed, the default in SPSS 21+)
//     — tracked in ROADMAP.md.
//   - String variables up to 255 bytes ("short string" limit). SPSS's "very
//     long string" (>255) extension is not implemented.
//   - Custom missing-value ranges are parsed (to keep byte offsets correct)
//     but not preserved; multiple-response sets are ignored.

const SYSMIS = -Number.MAX_VALUE;
const HEADER_PROD_NAME = '@(#) SPSS DATA FILE - OpenDoc Studio (opensource, client-side)';

class ByteWriter {
  constructor() {
    this.chunks = [];
    this.length = 0;
  }
  _push(buf) {
    this.chunks.push(buf);
    this.length += buf.byteLength;
  }
  writeInt32(value) {
    const b = new ArrayBuffer(4);
    new DataView(b).setInt32(0, value, true);
    this._push(new Uint8Array(b));
  }
  writeFloat64(value) {
    const b = new ArrayBuffer(8);
    new DataView(b).setFloat64(0, value, true);
    this._push(new Uint8Array(b));
  }
  writeRaw(bytes) {
    this._push(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  }
  writeFixedString(str, byteLength, padChar = 0x20) {
    const encoded = new TextEncoder().encode(str).slice(0, byteLength);
    const out = new Uint8Array(byteLength).fill(padChar);
    out.set(encoded);
    this._push(out);
  }
  writePadded4(str) {
    const encoded = new TextEncoder().encode(str);
    const padded = Math.ceil(encoded.length / 4) * 4;
    const out = new Uint8Array(padded);
    out.set(encoded);
    this._push(out);
    return encoded.length;
  }
  toUint8Array() {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  }
}

class ByteReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = 0;
  }
  readInt32() {
    const v = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return v;
  }
  readFloat64() {
    const v = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return v;
  }
  readRaw(n) {
    const v = this.bytes.subarray(this.offset, this.offset + n);
    this.offset += n;
    return v;
  }
  readString(n) {
    return new TextDecoder('utf-8', { fatal: false }).decode(this.readRaw(n));
  }
  get remaining() {
    return this.bytes.byteLength - this.offset;
  }
}

function formatCode(type, width, decimals) {
  return (type << 16) | (width << 8) | decimals;
}

function slotsForWidth(byteWidth) {
  return Math.ceil(byteWidth / 8);
}

function sanitizeShortName(index) {
  return `VAR${String(index).padStart(3, '0')}`;
}

function inferColumnType(rows, colIndex) {
  let isNumeric = true;
  let maxStringBytes = 1;
  let allIntegers = true;
  for (const row of rows) {
    const value = row[colIndex];
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'number') {
      if (!Number.isInteger(value)) allIntegers = false;
    } else {
      isNumeric = false;
      const bytes = new TextEncoder().encode(String(value)).length;
      if (bytes > maxStringBytes) maxStringBytes = bytes;
    }
  }
  return {
    type: isNumeric ? 'numeric' : 'string',
    decimals: allIntegers ? 0 : 2,
    width: isNumeric ? 8 : Math.min(255, Math.max(1, maxStringBytes))
  };
}

// table: { columns: [{ name }], rows: [[...values]] }
// Column types/widths are auto-detected from the data unless explicitly given.
export function writeSav(table) {
  const { rows } = table;
  const columns = table.columns.map((col, idx) => {
    const inferred = inferColumnType(rows, idx);
    return {
      name: col.name,
      label: col.label ?? col.name,
      type: col.type ?? inferred.type,
      width: col.width ?? inferred.width,
      decimals: col.decimals ?? inferred.decimals
    };
  });

  const w = new ByteWriter();
  const shortNames = columns.map((_, i) => sanitizeShortName(i + 1));
  const nominalCaseSize = columns.reduce(
    (sum, col) => sum + slotsForWidth(col.type === 'numeric' ? 8 : col.width),
    0
  );

  // --- File header record ---
  w.writeFixedString('$FL2', 4);
  w.writeFixedString(HEADER_PROD_NAME, 60);
  w.writeInt32(2); // layout_code
  w.writeInt32(nominalCaseSize);
  w.writeInt32(0); // compression: 0 = uncompressed
  w.writeInt32(0); // weight_index: no weight variable
  w.writeInt32(rows.length); // ncases
  w.writeFloat64(100.0); // bias
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateStr = `${String(now.getDate()).padStart(2, '0')} ${months[now.getMonth()]} ${String(now.getFullYear() % 100).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  w.writeFixedString(dateStr, 9);
  w.writeFixedString(timeStr, 8);
  w.writeFixedString('', 64); // file_label
  w.writeRaw(new Uint8Array(3)); // padding

  // --- Variable records (type 2), including string continuation records ---
  columns.forEach((col, idx) => {
    const labelBytes = new TextEncoder().encode(col.label);
    w.writeInt32(2);
    w.writeInt32(col.type === 'numeric' ? 0 : col.width);
    w.writeInt32(labelBytes.length > 0 ? 1 : 0);
    w.writeInt32(0); // n_missing_values
    const fmt = col.type === 'numeric' ? formatCode(5, 8, col.decimals) : formatCode(1, col.width, 0);
    w.writeInt32(fmt); // print
    w.writeInt32(fmt); // write
    w.writeFixedString(shortNames[idx], 8);
    if (labelBytes.length > 0) {
      w.writeInt32(labelBytes.length);
      w.writePadded4(col.label);
    }

    if (col.type === 'string') {
      const extraSlots = slotsForWidth(col.width) - 1;
      for (let i = 0; i < extraSlots; i += 1) {
        w.writeInt32(2);
        w.writeInt32(-1);
        w.writeInt32(0);
        w.writeInt32(0);
        w.writeInt32(0);
        w.writeInt32(0);
        w.writeFixedString('', 8);
      }
    }
  });

  // --- Record 7 subtype 3: machine integer info ---
  w.writeInt32(7);
  w.writeInt32(3);
  w.writeInt32(4);
  w.writeInt32(8);
  [1, 0, 0, -1, 1, 1, 2, 1].forEach((v) => w.writeInt32(v));

  // --- Record 7 subtype 4: floating point info ---
  w.writeInt32(7);
  w.writeInt32(4);
  w.writeInt32(8);
  w.writeInt32(3);
  w.writeFloat64(SYSMIS);
  w.writeFloat64(Number.MAX_VALUE);
  w.writeFloat64(-Number.MAX_VALUE);

  // --- Record 7 subtype 13: long variable names ---
  const longNamesText = columns.map((col, idx) => `${shortNames[idx]}=${col.name}`).join('\t');
  w.writeInt32(7);
  w.writeInt32(13);
  w.writeInt32(1);
  const longNamesBytes = new TextEncoder().encode(longNamesText);
  w.writeInt32(longNamesBytes.length);
  w.writeRaw(longNamesBytes);

  // --- Record 7 subtype 20: character encoding ---
  w.writeInt32(7);
  w.writeInt32(20);
  w.writeInt32(1);
  const enc = new TextEncoder().encode('UTF-8');
  w.writeInt32(enc.length);
  w.writeRaw(enc);

  // --- Dictionary termination record ---
  w.writeInt32(999);
  w.writeInt32(0);

  // --- Data record (uncompressed) ---
  for (const row of rows) {
    columns.forEach((col, idx) => {
      const value = row[idx];
      if (col.type === 'numeric') {
        const num = value === null || value === undefined || value === '' ? SYSMIS : Number(value);
        w.writeFloat64(Number.isFinite(num) ? num : SYSMIS);
      } else {
        const slotBytes = slotsForWidth(col.width) * 8;
        const str = value === null || value === undefined ? '' : String(value);
        const encoded = new TextEncoder().encode(str).slice(0, slotBytes);
        const out = new Uint8Array(slotBytes).fill(0x20);
        out.set(encoded);
        w.writeRaw(out);
      }
    });
  }

  return w.toUint8Array();
}

function decompressSimple(reader, bias) {
  // Decodes the "simple bytecode" scheme into a flat byte stream matching what
  // an uncompressed data record would contain, so the case-parsing loop below
  // can treat both forms identically.
  const out = [];
  let done = false;
  while (!done && reader.remaining >= 8) {
    const codes = reader.readRaw(8);
    for (const code of codes) {
      if (done) break;
      if (code === 0) continue;
      if (code >= 1 && code <= 251) {
        const b = new ArrayBuffer(8);
        new DataView(b).setFloat64(0, code - bias, true);
        out.push(new Uint8Array(b));
      } else if (code === 252) {
        done = true;
      } else if (code === 253) {
        out.push(new Uint8Array(reader.readRaw(8)));
      } else if (code === 254) {
        out.push(new Uint8Array(8).fill(0x20));
      } else if (code === 255) {
        const b = new ArrayBuffer(8);
        new DataView(b).setFloat64(0, SYSMIS, true);
        out.push(new Uint8Array(b));
      }
    }
  }
  const flat = new Uint8Array(out.length * 8);
  out.forEach((chunk, i) => flat.set(chunk, i * 8));
  return flat;
}

export function readSav(bytes) {
  const reader = new ByteReader(bytes);
  const recType = reader.readString(4);
  if (recType !== '$FL2') {
    throw new Error(
      recType === '$FL3'
        ? 'File .sav ini menggunakan kompresi ZLIB ($FL3, umum di SPSS 21+) yang belum didukung. Simpan ulang dari SPSS sebagai format kompatibel lama, atau gunakan file tanpa kompresi ZLIB.'
        : `Bukan file .sav yang valid (rec_type tidak dikenal: "${recType}").`
    );
  }
  reader.readString(60); // prod_name
  reader.readInt32(); // layout_code
  reader.readInt32(); // nominal_case_size
  const compression = reader.readInt32();
  reader.readInt32(); // weight_index
  const ncases = reader.readInt32();
  const bias = reader.readFloat64();
  reader.readString(9); // creation_date
  reader.readString(8); // creation_time
  reader.readString(64); // file_label
  reader.readRaw(3); // padding

  const columns = []; // { shortName, byteWidth, type, decimals }
  const longNameMap = {};

  while (true) {
    const tag = reader.readInt32();
    if (tag === 2) {
      const type = reader.readInt32();
      const hasLabel = reader.readInt32();
      const nMissing = reader.readInt32();
      const printFmt = reader.readInt32();
      reader.readInt32(); // write format
      const shortName = reader.readString(8).trim();

      if (type === -1) {
        // Continuation of the previous string variable's extra 8-byte slot.
        // byteWidth on the primary record already accounts for every slot via
        // ceil(type / 8) * 8, so continuation records are pure structural
        // markers here — nothing to add, just skip past them.
        continue;
      }

      let label = null;
      if (hasLabel === 1) {
        const labelLen = reader.readInt32();
        const padded = Math.ceil(labelLen / 4) * 4;
        label = reader.readString(labelLen);
        reader.readRaw(padded - labelLen);
      }

      if (nMissing === 1 || nMissing === 2 || nMissing === 3) {
        for (let i = 0; i < nMissing; i += 1) reader.readFloat64();
      } else if (nMissing === -2) {
        reader.readFloat64();
        reader.readFloat64();
      } else if (nMissing === -3) {
        reader.readFloat64();
        reader.readFloat64();
        reader.readFloat64();
      }

      const decimals = printFmt & 0xff;
      columns.push({
        shortName,
        label: label ?? shortName,
        type: type === 0 ? 'numeric' : 'string',
        stringWidth: type,
        byteWidth: type === 0 ? 8 : Math.ceil(type / 8) * 8,
        decimals
      });
    } else if (tag === 7) {
      const subtype = reader.readInt32();
      const size = reader.readInt32();
      const count = reader.readInt32();
      const totalBytes = size * count;
      const data = reader.readRaw(totalBytes);
      if (subtype === 13) {
        const text = new TextDecoder('utf-8').decode(data);
        text.split('\t').filter(Boolean).forEach((pair) => {
          const eq = pair.indexOf('=');
          if (eq > -1) longNameMap[pair.slice(0, eq)] = pair.slice(eq + 1);
        });
      }
      // Other subtypes (machine info, floating-point info, encoding, etc.) are
      // consumed above to keep the offset correct but not otherwise used.
    } else if (tag === 999) {
      reader.readInt32(); // filler
      break;
    } else {
      throw new Error(`Struktur file .sav tidak dikenali (tag ${tag}).`);
    }
  }

  const finalColumns = columns.map((col) => ({
    name: longNameMap[col.shortName] ?? col.shortName,
    type: col.type,
    decimals: col.decimals
  }));

  const rawData = compression === 1 ? decompressSimple(reader, bias) : reader.readRaw(reader.remaining);
  const caseReader = new ByteReader(rawData);
  const rows = [];
  const targetCases = ncases >= 0 ? ncases : Infinity;

  while (rows.length < targetCases && caseReader.remaining >= 8) {
    const row = [];
    let stop = false;
    for (const col of columns) {
      if (caseReader.remaining < col.byteWidth) {
        stop = true;
        break;
      }
      if (col.type === 'numeric') {
        const value = caseReader.readFloat64();
        row.push(value === SYSMIS ? null : value);
      } else {
        const raw = caseReader.readRaw(col.byteWidth);
        row.push(new TextDecoder('utf-8', { fatal: false }).decode(raw).replace(/\s+$/, ''));
      }
    }
    if (stop) break;
    rows.push(row);
  }

  return { columns: finalColumns, rows };
}
