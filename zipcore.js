// zipcore.js – minimálny čítač ZIP súborov pre options stránku.
// Číta len centrálny adresár + textové súbory (stored aj deflate cez DecompressionStream).
// Použitie: const files = await BU.zip.read(arrayBuffer); files[i].name, files[i].text()
(function (g) {
  'use strict';
  const u16 = (d, o) => d.getUint16(o, true);
  const u32 = (d, o) => d.getUint32(o, true);
  const td = new TextDecoder();
  async function inflateRaw(buf) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  /** Prečíta ZIP a vráti zoznam súborov [{ name, text() }]. @param {ArrayBuffer} ab @returns {Promise<Array>} */
  async function read(ab) {
    const d = new DataView(ab);
    let eocd = -1;                                        // End Of Central Directory (scan od konca)
    for (let i = d.byteLength - 22; i >= Math.max(0, d.byteLength - 66000); i--) {
      if (u32(d, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('zip: EOCD not found');
    const count = u16(d, eocd + 10);
    let p = u32(d, eocd + 16);
    const files = [];
    for (let i = 0; i < count && p + 46 <= d.byteLength; i++) {
      if (u32(d, p) !== 0x02014b50) break;               // centrálny záznam
      const method = u16(d, p + 10);
      const csize = u32(d, p + 20);
      const nameLen = u16(d, p + 28), extraLen = u16(d, p + 30), commentLen = u16(d, p + 32);
      const off = u32(d, p + 42);                         // offset lokálnej hlavičky
      const name = td.decode(new Uint8Array(ab, p + 46, nameLen));
      const lNameLen = u16(d, off + 26), lExtraLen = u16(d, off + 28);
      const dataStart = off + 30 + lNameLen + lExtraLen;
      const csizeSafe = Math.min(csize, d.byteLength - dataStart);
      const raw = new Uint8Array(ab, dataStart, csizeSafe);
      const file = { name, method, _t: undefined, text: async function () {
        if (this._t !== undefined) return this._t;
        const bytes = this.method === 0 ? raw : await inflateRaw(raw);
        this._t = td.decode(bytes);
        return this._t;
      } };
      files.push(file);
      p += 46 + nameLen + extraLen + commentLen;
    }
    return files;
  }
  g.BU = g.BU || {};
  g.BU.zip = { read };
})(typeof self !== 'undefined' ? self : globalThis);
