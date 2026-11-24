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

function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const lenSq = vx * vx + vy * vy;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq)) : 0;
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function polygonSdf(px, py, poly) {
  let minD = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const d = distToSegment(px, py, poly[j][0], poly[j][1], poly[i][0], poly[i][1]);
    if (d < minD) minD = d;
  }
  return pointInPolygon(px, py, poly) ? -minD : minD;
}

function mixColor(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k
  ];
}

function compositeOver(dst, srcRgb, srcA) {
  const a = Math.max(0, Math.min(1, srcA));
  if (a <= 0) return dst;
  const outA = a + dst[3] * (1 - a);
  if (outA <= 0) return [0, 0, 0, 0];
  return [
    (srcRgb[0] * a + dst[0] * dst[3] * (1 - a)) / outA,
    (srcRgb[1] * a + dst[1] * dst[3] * (1 - a)) / outA,
    (srcRgb[2] * a + dst[2] * dst[3] * (1 - a)) / outA,
    outA
  ];
}

// Slanted aerodynamic 'F' ribbon geometry (transparent background)
const F_STEM = [
  [-0.1, -0.52],
  [0.14, -0.52],
  [-0.16, 0.62],
  [-0.36, 0.5]
];

const F_TOP_ARM = [
  [-0.1, -0.52],
  [0.56, -0.52],
  [0.4, -0.28],
  [-0.14, -0.28]
];

const F_MID_ARM = [
  [-0.16, -0.06],
  [0.34, -0.06],
  [0.21, 0.16],
  [-0.21, 0.16]
];

const F_TOP_HIGHLIGHT = [
  [0.1, -0.52],
  [0.56, -0.52],
  [0.4, -0.28],
  [0.14, -0.28]
];

const F_MID_HIGHLIGHT = [
  [0.05, -0.06],
  [0.34, -0.06],
  [0.21, 0.16],
  [0.03, 0.16]
];

const CORAL = [250, 114, 80];
const MAGENTA = [255, 24, 147];
const WHITE = [255, 255, 255];

function createPngBuffer(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const center = size / 2;
  const aa = 1.8 / (size * 0.48);

  const cosA = Math.cos(-0.46);
  const sinA = Math.sin(-0.46);

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;

    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 4;
      const nx = (x + 0.5 - center) / (size * 0.44);
      const ny = (y + 0.5 - center) / (size * 0.44);
      const gradT = (nx + ny + 1.2) / 2.4;
      const brandColor = mixColor(CORAL, MAGENTA, gradT);

      // Start completely transparent
      let rgba = [0, 0, 0, 0];

      // Back half of tilted elliptical orbit ring
      const ox = nx * cosA - ny * sinA;
      const oy = nx * sinA + ny * cosA;
      const orbitVal = Math.hypot(ox / 0.94, oy / 0.27) - 1;
      const orbitDist = Math.abs(orbitVal) * 0.3 - 0.019;
      if (oy < 0 && orbitDist < aa) {
        const oa = Math.max(0, Math.min(1, (aa - orbitDist) / (2 * aa)));
        rgba = compositeOver(rgba, mixColor(brandColor, WHITE, 0.42), oa * 0.78);
      }

      // Open circular navigation ring
      const rDist = Math.hypot(nx, ny);
      const ringDist = Math.abs(rDist - 0.72) - 0.088;
      const ang = Math.atan2(ny, nx);
      const inGapTop = ang > -0.78 && ang < -0.18;
      const inGapBot = ang > 2.02 && ang < 2.58;

      if (!inGapTop && !inGapBot && ringDist < aa) {
        const ra = Math.max(0, Math.min(1, (aa - ringDist) / (2 * aa)));
        const ringShade = mixColor(CORAL, MAGENTA, (nx + 0.8) / 1.6);
        rgba = compositeOver(rgba, ringShade, ra);
      }

      // Aerodynamic slanted 'F' ribbon
      const dF = Math.min(
        polygonSdf(nx, ny, F_STEM),
        polygonSdf(nx, ny, F_TOP_ARM),
        polygonSdf(nx, ny, F_MID_ARM)
      );

      if (dF < aa) {
        const fa = Math.max(0, Math.min(1, (aa - dF) / (2 * aa)));
        let fColor = brandColor;
        const dHi = Math.min(
          polygonSdf(nx, ny, F_TOP_HIGHLIGHT),
          polygonSdf(nx, ny, F_MID_HIGHLIGHT)
        );
        if (dHi < aa) {
          const ha = Math.max(0, Math.min(1, (aa - dHi) / (2 * aa)));
          fColor = mixColor(fColor, WHITE, ha * 0.35);
        }
        rgba = compositeOver(rgba, fColor, fa);
      }

      // Front swoosh of tilted orbital halo
      if (oy >= 0 && orbitDist < aa) {
        const oa = Math.max(0, Math.min(1, (aa - orbitDist) / (2 * aa)));
        rgba = compositeOver(rgba, mixColor(brandColor, WHITE, 0.58), oa * 0.94);
      }

      raw[px] = Math.round(Math.max(0, Math.min(255, rgba[0])));
      raw[px + 1] = Math.round(Math.max(0, Math.min(255, rgba[1])));
      raw[px + 2] = Math.round(Math.max(0, Math.min(255, rgba[2])));
      raw[px + 3] = Math.round(Math.max(0, Math.min(255, rgba[3] * 255)));
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
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
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, pngBuf]);
}

const png512 = createPngBuffer(512);
const png256 = createPngBuffer(256);
const ico256 = wrapPngInIco(png256, 256);

fs.writeFileSync(path.join(outDir, 'icon.png'), png512);
fs.writeFileSync(path.join(outDir, 'icon.ico'), ico256);
console.log('Generated build/icon.png (512x512) and build/icon.ico (256x256)');
