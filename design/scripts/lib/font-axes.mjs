// D-GAP-A shrink (01-14 Task 2): a dependency-free, no-I/O reader of an sfnt
// font's `fvar` (font variations) table. build-fonts.mjs uses this to pin
// Source Serif 4's `opsz` axis to each source's own fvar default, instead of
// a guessed number — the main lever that shrinks the subset (Task 3).
//
// No package and no file I/O by design (Task 2 acceptance criteria): the
// caller reads the font file and hands this module a Buffer.

const SFNT_VERSION_TRUETYPE = 0x00010000;
const SFNT_VERSION_TRUETYPE_APPLE = 0x74727565; // 'true'
const SFNT_VERSION_OTTO = 0x4f54544f; // 'OTTO'

const REJECTED_TAGS = {
  0x774f4646: 'wOFF', // 'wOFF'
  0x774f4632: 'wOF2', // 'wOF2'
  0x74746366: 'ttcf', // 'ttcf' (font collection)
};

/**
 * Reads a big-endian uint32 at `offset`, throwing (mentioning "sfnt") if the
 * read would run past the end of `buffer`.
 */
function readUInt32(buffer, offset, context) {
  if (offset < 0 || offset + 4 > buffer.length) {
    throw new Error(`readVariationAxes: sfnt buffer truncated while reading ${context} at offset ${offset}`);
  }
  return buffer.readUInt32BE(offset);
}

function readUInt16(buffer, offset, context) {
  if (offset < 0 || offset + 2 > buffer.length) {
    throw new Error(`readVariationAxes: sfnt buffer truncated while reading ${context} at offset ${offset}`);
  }
  return buffer.readUInt16BE(offset);
}

/**
 * Reads a big-endian 16.16 fixed-point number (the fvar spec's format for
 * minValue/defaultValue/maxValue) at `offset`.
 */
function readFixed1616(buffer, offset, context) {
  const raw = readUInt32(buffer, offset, context);
  // Fixed is a signed 32-bit value; readUInt32BE gives us the unsigned bit
  // pattern, so reinterpret as signed before dividing by 65536.
  const signed = raw > 0x7fffffff ? raw - 0x100000000 : raw;
  return signed / 65536;
}

function tagToString(tagUInt32) {
  const bytes = [
    (tagUInt32 >>> 24) & 0xff,
    (tagUInt32 >>> 16) & 0xff,
    (tagUInt32 >>> 8) & 0xff,
    tagUInt32 & 0xff,
  ];
  return Buffer.from(bytes).toString('ascii');
}

/**
 * Reads the `fvar` (font variations) table out of a raw sfnt (TrueType/CFF)
 * font buffer. Returns `[{ tag, min, default, max }]` in font order, or `[]`
 * if the font has no `fvar` table (a static font). Throws an `Error`
 * mentioning "sfnt" on a truncated or malformed buffer, or an `Error` naming
 * WOFF/WOFF2 when handed compressed input (the caller must read the source
 * TTF instead — this module never decompresses).
 */
export function readVariationAxes(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('readVariationAxes: expected a Buffer');
  }

  if (buffer.length < 4) {
    throw new Error('readVariationAxes: sfnt buffer truncated — fewer than 4 bytes');
  }

  const firstFourTag = buffer.readUInt32BE(0);
  if (firstFourTag in REJECTED_TAGS) {
    throw new Error(
      `readVariationAxes: WOFF/WOFF2 input is not supported (found "${REJECTED_TAGS[firstFourTag]}") — read the source TTF instead`
    );
  }

  const sfntVersion = readUInt32(buffer, 0, 'sfnt version');
  const validVersion =
    sfntVersion === SFNT_VERSION_TRUETYPE ||
    sfntVersion === SFNT_VERSION_TRUETYPE_APPLE ||
    sfntVersion === SFNT_VERSION_OTTO;
  if (!validVersion) {
    throw new Error(
      `readVariationAxes: unrecognised sfnt version 0x${sfntVersion.toString(16)} (tag "${tagToString(sfntVersion)}")`
    );
  }

  const numTables = readUInt16(buffer, 4, 'numTables');

  // Table directory: 12-byte header, then numTables x 16-byte records
  // (tag: 4, checksum: 4, offset: 4, length: 4).
  const TABLE_RECORD_SIZE = 16;
  const DIRECTORY_HEADER_SIZE = 12;
  let fvarOffset = null;
  let fvarLength = null;

  for (let i = 0; i < numTables; i++) {
    const recordOffset = DIRECTORY_HEADER_SIZE + i * TABLE_RECORD_SIZE;
    const tagValue = readUInt32(buffer, recordOffset, `table record ${i} tag`);
    const tag = tagToString(tagValue);
    if (tag === 'fvar') {
      fvarOffset = readUInt32(buffer, recordOffset + 8, `table record ${i} offset`);
      fvarLength = readUInt32(buffer, recordOffset + 12, `table record ${i} length`);
      break;
    }
  }

  if (fvarOffset === null) {
    return []; // no fvar table — a static font
  }

  if (fvarOffset + fvarLength > buffer.length || fvarLength < 16) {
    throw new Error('readVariationAxes: sfnt buffer truncated — fvar table extends past end of buffer');
  }

  // fvar header (MS/Apple spec): majorVersion(2) minorVersion(2)
  // axesArrayOffset(2) reserved(2) axisCount(2) axisSize(2)
  // instanceCount(2) instanceSize(2) = 16 bytes.
  const axesArrayOffset = readUInt16(buffer, fvarOffset + 4, 'fvar axesArrayOffset');
  const axisCount = readUInt16(buffer, fvarOffset + 8, 'fvar axisCount');
  const axisSize = readUInt16(buffer, fvarOffset + 10, 'fvar axisSize');

  const axes = [];
  const axesStart = fvarOffset + axesArrayOffset;
  for (let i = 0; i < axisCount; i++) {
    const axisOffset = axesStart + i * axisSize;
    const tagValue = readUInt32(buffer, axisOffset, `fvar axis record ${i} tag`);
    const min = readFixed1616(buffer, axisOffset + 4, `fvar axis record ${i} minValue`);
    const def = readFixed1616(buffer, axisOffset + 8, `fvar axis record ${i} defaultValue`);
    const max = readFixed1616(buffer, axisOffset + 12, `fvar axis record ${i} maxValue`);
    axes.push({ tag: tagToString(tagValue), min, default: def, max });
  }

  return axes;
}
