// 07-02 (D-13 as amended by D-23): a dependency-free ICO container encoder.
//
// Layout (all integers little-endian):
//   ICONDIR       6 bytes   reserved u16 = 0, type u16 = 1 (icon), count u16
//   ICONDIRENTRY  16 bytes each
//                 width u8 (0 means 256), height u8 (0 means 256), colour count u8 = 0,
//                 reserved u8 = 0, planes u16 = 1, bit count u16 = 32,
//                 bytesInRes u32 (PNG length), imageOffset u32
//   image data    the PNG files verbatim (PNG-compressed entries, supported by every current
//                 browser and by Windows Vista and later)
//
// Only the 32x32 entry ships today; the encoder stays general. Entries must be square, unique and
// sorted ascending by size so the output is deterministic.

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HEADER_BYTES = 6;
const ENTRY_BYTES = 16;

/**
 * @param {{ size: number, png: Buffer }[]} entries
 * @returns {Buffer}
 */
export function encodeIco(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('encodeIco: needs at least one entry (empty list)');
  }
  let previous = 0;
  for (const { size, png } of entries) {
    if (!Number.isInteger(size) || size < 1 || size > 256) {
      throw new Error(`encodeIco: size ${size} is outside 1..256`);
    }
    if (!Buffer.isBuffer(png) || png.length < PNG_SIGNATURE.length || !png.subarray(0, 8).equals(PNG_SIGNATURE)) {
      throw new Error(`encodeIco: entry ${size} is not a PNG (missing signature)`);
    }
    if (size === previous) {
      throw new Error(`encodeIco: duplicate size ${size}`);
    }
    if (size < previous) {
      throw new Error(`encodeIco: entries must be sorted ascending by size (${size} after ${previous})`);
    }
    previous = size;
  }

  const header = Buffer.alloc(HEADER_BYTES + ENTRY_BYTES * entries.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let offset = header.length;
  entries.forEach(({ size, png }, i) => {
    const at = HEADER_BYTES + ENTRY_BYTES * i;
    const dimension = size === 256 ? 0 : size;
    header.writeUInt8(dimension, at);
    header.writeUInt8(dimension, at + 1);
    header.writeUInt8(0, at + 2);
    header.writeUInt8(0, at + 3);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([header, ...entries.map((e) => e.png)]);
}
