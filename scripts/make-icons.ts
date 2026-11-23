// Erzeugt die Home-Bildschirm-Icons aus Kraxels Kopf (npm run icons). Eigener PNG-Schreiber, keine Abhängigkeiten.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { bakeGrid } from '../src/gfx/bake.ts';
import { BASE } from '../src/gfx/palette.ts';
import { buildSprites } from '../src/gfx/sprites.ts';

const BACKGROUND = [0x2e, 0xc4, 0xb6];
const MARGIN = 0.15;
const HEAD_ROWS = 13;

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(size: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // Bits je Kanal
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    // Filterbyte 0 (kein Filter) je Zeile
    raw.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0)),
  ]);
}

/** Kopf ganzzahlig vergrößert, mittig, im Rand von MARGIN je Seite. */
function renderIcon(size: number): Buffer {
  const head = bakeGrid(buildSprites()['kraxel'].slice(0, HEAD_ROWS), BASE);
  const scale = Math.max(1, Math.floor((size * (1 - 2 * MARGIN)) / Math.max(head.width, head.height)));
  const ox = Math.floor((size - head.width * scale) / 2), oy = Math.floor((size - head.height * scale) / 2);
  const px = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) px.set([...BACKGROUND, 255], i * 4);
  for (let y = 0; y < head.height * scale; y++) {
    for (let x = 0; x < head.width * scale; x++) {
      const s = ((Math.floor(y / scale)) * head.width + Math.floor(x / scale)) * 4;
      if (head.data[s + 3] === 0) continue;
      px.set(head.data.subarray(s, s + 4), ((oy + y) * size + ox + x) * 4);
    }
  }
  return encodePng(size, px);
}

mkdirSync('public/icons', { recursive: true });
for (const size of [180, 192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, renderIcon(size));
  console.log(`public/icons/icon-${size}.png`);
}
