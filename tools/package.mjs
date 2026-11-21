// tools/package.mjs – balíčkovanie (Node, cross-platform)
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const common = [
  'background.js', 'themes.js', 'text-utils.js', 'schedule.js', 'content.js', 'base.css',
  'popup.html', 'popup.js', 'options.html', 'options.js', 'options.css',
  'icon128.png', 'ais-logo.png',
];

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const version = manifest.version;

function zipFiles(files) {
  // Minimal ZIP writer (stored + deflate)
  const entries = [];
  let offset = 0;
  const chunks = [];
  const central = [];
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name);
    const crc = crc32(data);
    const deflated = zlib.deflateRawSync(data);
    const useDeflate = deflated.length < data.length;
    const payload = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(payload.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    const localHeader = Buffer.concat([lh, nameBuf]);
    chunks.push(localHeader, payload);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(payload.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cd, nameBuf]));
    offset += localHeader.length + payload.length;
  }
  const centralBuf = Buffer.concat(central);
  const cdOffset = offset;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuf, eocd]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[i] = c; }
    return t;
  })());
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function build(target) {
  const manFile = target === 'firefox' ? 'manifest.firefox.json' : 'manifest.json';
  const stage = join(dist, target);
  if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  const man = JSON.parse(readFileSync(join(root, manFile), 'utf8'));
  writeFileSync(join(stage, 'manifest.json'), JSON.stringify(man, null, 2) + '\n');
  for (const f of common) {
    const src = join(root, f);
    if (existsSync(src)) cpSync(src, join(stage, f));
  }
  // zip
  const files = [];
  function walk(dir, base) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full, base);
      else files.push({ name: full.slice(base.length + 1).replace(/\\/g, '/'), data: readFileSync(full) });
    }
  }
  walk(stage, stage);
  const zip = zipFiles(files);
  const zipPath = join(dist, `betterais-${target}-${version}.zip`);
  if (existsSync(zipPath)) rmSync(zipPath);
  writeFileSync(zipPath, zip);
  rmSync(stage, { recursive: true, force: true });
  console.log('OK', zipPath);
}

const target = process.argv[2] || 'both';
if (target === 'both') { build('chrome'); build('firefox'); }
else build(target);