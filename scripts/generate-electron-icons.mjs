import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '..', 'build');

fs.mkdirSync(outDir, { recursive: true });

// Precompute CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPngBuffer(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const center = size / 2;
  const cornerRadius = size * 0.22;
  const pad = size * 0.06;
  const boxHalf = size / 2 - pad;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter none

    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 4;
      const dx = Math.abs(x + 0.5 - center);
      const dy = Math.abs(y + 0.5 - center);

      // Rounded square SDF
      const qx = Math.max(dx - (boxHalf - cornerRadius), 0);
      const qy = Math.max(dy - (boxHalf - cornerRadius), 0);
      const dist = Math.hypot(qx, qy) - cornerRadius;

      if (dist > 0.75) {
        raw[px] = 0;
        raw[px + 1] = 0;
        raw[px + 2] = 0;
        raw[px + 3] = 0;
        continue;
      }

      const alpha = Math.max(0, Math.min(1, 0.75 - dist));
      const t = Math.max(0, Math.min(1, (x + y) / (2 * size)));

      // FabiNav coral (#fa7250) -> magenta (#ff1893) gradient
      let r = Math.round(250 + (255 - 250) * t);
      let g = Math.round(114 + (24 - 114) * t);
      let b = Math.round(80 + (147 - 80) * t);

      // Crisp inner white shield / 'F' compass emblem
      const nx = (x + 0.5 - center) / (size * 0.34);
      const ny = (y + 0.5 - center) / (size * 0.36);

      const inOuterShield =
        ny >= -0.92 &&
        ny <= 0.96 &&
        Math.abs(nx) <= (ny < 0.15 ? 0.84 : Math.max(0, 0.84 * (1 - ((ny - 0.15) / 0.85) ** 1.25)));

      const inInnerShield =
        ny >= -0.72 &&
        ny <= 0.74 &&
        Math.abs(nx) <= (ny < 0.1 ? 0.62 : Math.max(0, 0.62 * (1 - ((ny - 0.1) / 0.68) ** 1.25)));

      // Stylized 'F' bar inside shield
      const inFStem = nx >= -0.24 && nx <= -0.04 && ny >= -0.42 && ny <= 0.44;
      const inFTop = nx >= -0.24 && nx <= 0.32 && ny >= -0.42 && ny <= -0.22;
      const inFMid = nx >= -0.24 && nx <= 0.2 && ny >= -0.08 && ny <= 0.1;

      if ((inOuterShield && !inInnerShield) || inFStem || inFTop || inFMid) {
        r = 255;
        g = 255;
        b = 255;
      }

      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = Math.round(alpha * 255);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function wrapPngInIco(pngBuf, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(1, 4); // count = 1 image

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(22, 12); // offset right after 6 + 16 header bytes

  return Buffer.concat([header, entry, pngBuf]);
}

const png512 = createPngBuffer(512);
const png256 = createPngBuffer(256);
const ico256 = wrapPngInIco(png256, 256);

fs.writeFileSync(path.join(outDir, 'icon.png'), png512);
fs.writeFileSync(path.join(outDir, 'icon.ico'), ico256);
console.log('Generated build/icon.png (512x512) and build/icon.ico (256x256)');
