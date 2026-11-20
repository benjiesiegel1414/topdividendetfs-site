// Renders favicon.svg to the PNG and ICO browser-tab / home-screen icons.
// Needs @resvg/resvg-js (installed in the image step of the Build ETF pages workflow).
import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const svg = fs.readFileSync(path.join(ROOT, 'favicon.svg'), 'utf8');
const png = size => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
const out = { 'favicon-16x16.png': 16, 'favicon-32x32.png': 32, 'apple-touch-icon.png': 180, 'android-chrome-192x192.png': 192, 'android-chrome-512x512.png': 512 };
for (const [f, s] of Object.entries(out)) fs.writeFileSync(path.join(ROOT, f), png(s));
// ICO holding 16, 32 and 48 px PNGs
const imgs = [16, 32, 48].map(s => ({ s, d: png(s) }));
const head = Buffer.alloc(6 + 16 * imgs.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(imgs.length, 4);
let off = head.length;
imgs.forEach((im, i) => {
  const o = 6 + 16 * i;
  head.writeUInt8(im.s, o); head.writeUInt8(im.s, o + 1); head.writeUInt8(0, o + 2); head.writeUInt8(0, o + 3);
  head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(im.d.length, o + 8); head.writeUInt32LE(off, o + 12);
  off += im.d.length;
});
fs.writeFileSync(path.join(ROOT, 'favicon.ico'), Buffer.concat([head, ...imgs.map(i => i.d)]));
console.log('favicons built');
