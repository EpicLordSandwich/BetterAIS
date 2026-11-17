// Test zipcore.js – syntetický zip (stored + deflate) v node. node tools/tests/test-zip-core.mjs
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const self = globalThis;
await import(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../zipcore.js'));

let failed = 0;
function ok(cond, name) { console.log((cond ? 'OK   ' : 'FAIL ') + name); if (!cond) failed++; }

// Postaví minimálny zip: dva súbory (jeden stored, jeden deflate-raw).
function buildZip() {
  const enc = new TextEncoder();
  const files = [
    { name: 'updates/remote.json', data: Buffer.from('{"themes":{"c-x":{"name":"X"}}}'), method: 0 },
    { name: 'BetterAIS-main/manifest.json', data: Buffer.from('{"version":"9.9.9"}'), method: 8 },
  ];
  const chunks = []; const central = [];
  let offset = 0;
  for (const f of files) {
    const nameB = enc.encode(f.name);
    const data = f.method === 8 ? zlib.deflateRawSync(f.data) : f.data;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(f.method, 8); lh.writeUInt16LE(0, 10);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(f.data.length, 22);
    lh.writeUInt16LE(nameB.length, 26); lh.writeUInt16LE(0, 28);
    chunks.push(lh, Buffer.from(nameB), data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(f.method, 10);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(f.data.length, 24);
    ch.writeUInt16LE(nameB.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([ch, Buffer.from(nameB)]));
    offset += lh.length + nameB.length + data.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cd, eocd]);
}

const zip = buildZip();
const ab = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength);
const files = await self.BU.zip.read(ab);
ok(files.length === 2, 'zip: 2 subory');
const remote = files.find((f) => f.name.endsWith('remote.json'));
const manifest = files.find((f) => f.name.endsWith('manifest.json'));
ok(!!remote && JSON.parse(await remote.text()).themes['c-x'].name === 'X', 'zip: stored remote.json prečítaný');
ok(!!manifest && JSON.parse(await manifest.text()).version === '9.9.9', 'zip: deflate manifest.json prečítaný');

// Neplatný vstup nespadne, ale hodí chybu.
let threw = false;
try { await self.BU.zip.read(new ArrayBuffer(10)); } catch (e) { threw = true; }
ok(threw, 'zip: neplatný vstup hodí chybu');

console.log(failed ? 'FAIL' : 'VŠETKO OK');
process.exit(failed ? 1 : 0);
