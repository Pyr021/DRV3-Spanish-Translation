// Identifica cada slot .stx del .spc por CONTENIDO: compara la PRIMERA cadena
// del slot con el primer bloque (##### 0000) de cada .txt de referencia.
// Asi el emparejamiento es inequivoco, sin depender del orden.
import fs from 'fs';
import path from 'path';

function bitReverse(b) { let r = 0; for (let i = 0; i < 8; i++) { r = (r << 1) | (b & 1); b >>= 1; } return r & 0xFF; }
function spcDec(buf, decSize) {
  const cmpSize = buf.length; if (decSize <= 0) decSize = cmpSize * 2;
  const out = []; let flag = 1, pos = 0;
  while (pos < cmpSize) {
    if (flag === 1) flag = 0x100 | bitReverse(buf[pos++]);
    if (pos >= cmpSize) break;
    if (flag & 1) out.push(buf[pos++]);
    else {
      if (pos + 1 >= cmpSize) break;
      const b = buf.readUInt16LE(pos); pos += 2;
      const c = (b >> 10) + 2, o = b & 1023;
      for (let i = 0; i < c; i++) out.push(out[out.length - 1024 + o]);
    }
    flag >>= 1;
  }
  return Buffer.from(out);
}
function parseSpc(p) {
  const b = fs.readFileSync(p); let pos = 4 + 0x24;
  const n = b.readUInt32LE(pos); pos += 4 + 4 + 0x10 + 4 + 0x0C;
  const o = [];
  for (let i = 0; i < n; i++) {
    const cf = b.readUInt16LE(pos); pos += 2; const uf = b.readUInt16LE(pos); pos += 2;
    const cs = b.readUInt32LE(pos); pos += 4; const ds = b.readUInt32LE(pos); pos += 4;
    const nl = b.readUInt32LE(pos); pos += 4 + 0x10;
    const np = (0x10 - ((nl + 1) % 0x10)) % 0x10, dp = (0x10 - (cs % 0x10)) % 0x10;
    const name = b.toString('utf-8', pos, pos + nl); pos += nl + np + 1;
    const raw = b.slice(pos, pos + cs); pos += cs + dp;
    o.push({ i, name, cf, ds, raw });
  }
  return o;
}
function parseBloques(t) {
  const ps = t.replace(/\r\n/g, '\n').split(/^#####[ \t]*(\d+)[ \t]*\n?/m);
  const m = new Map();
  for (let i = 1; i + 1 < ps.length; i += 2) {
    const idx = parseInt(ps[i], 10); if (Number.isNaN(idx)) continue;
    let s = ps[i + 1] ?? '';
    if (s.endsWith('\n\n')) s = s.slice(0, -2); else if (s.endsWith('\n')) s = s.slice(0, -1);
    m.set(idx, s);
  }
  return m;
}

const spc = process.argv[2];
const refTxtDir = process.argv[3];   // game_resident_txt (ingles original)
const outMap = process.argv[4];      // donde guardar el mapeo

const subs = parseSpc(spc);
const esStx = subs.map(s => { const d = s.cf === 2 ? spcDec(s.raw, s.ds) : s.raw; return d.length > 4 && d.toString('ascii', 0, 4) === 'STXT'; });

// primer bloque de cada .txt de referencia (texto ingles = texto del slot original)
const refs = new Map();
for (const f of fs.readdirSync(refTxtDir).filter(x => x.endsWith('.txt'))) {
  const m = parseBloques(fs.readFileSync(path.join(refTxtDir, f), 'utf-8'));
  const primero = [...m.entries()].find(([, v]) => v.trim() !== '');
  if (primero) refs.set(f, primero[1].slice(0, 200));
}

const mapeo = {};
const usados = new Set();
let ok = 0, sin = 0;

for (const s of subs) {
  if (!esStx[s.i]) continue;
  const d = s.cf === 2 ? spcDec(s.raw, s.ds) : s.raw;
  const info = (() => {
    const t = d.readUInt32LE(12), n = d.readUInt32LE(20);
    for (let i = 0; i < n; i++) {
      const so = d.readUInt32LE(t + i * 8 + 4);
      let e = so;
      while (e + 1 < d.length && !(d[e] === 0 && d[e + 1] === 0)) e += 2;
      const str = d.toString('utf16le', so, e);
      if (str.trim() !== '') return str.slice(0, 200);
    }
    return null;
  })();

  let mejor = null;
  for (const [f, primero] of refs) {
    if (usados.has(f)) continue;
    if (primero === info) { mejor = f; break; }
  }
  if (!mejor) {
    // segundo intento: comparacion laxa (primeros 60 caracteres)
    for (const [f, primero] of refs) {
      if (usados.has(f)) continue;
      if (info && primero.slice(0, 60) === info.slice(0, 60)) { mejor = f; break; }
    }
  }
  if (mejor) { mapeo[s.i] = mejor; usados.add(mejor); ok++; }
  else { mapeo[s.i] = null; sin++; console.log(`  sin identificar: slot ${s.i}  primer texto: ${JSON.stringify((info || '').slice(0, 70))}`); }
}

console.log(`Slots .stx           : ${Object.keys(mapeo).length}`);
console.log(`Identificados por contenido: ${ok}`);
console.log(`Sin identificar      : ${sin}`);
console.log(`Archivos sin slot    : ${[...refs.keys()].filter(f => !usados.has(f)).join(', ') || '(ninguno)'}`);
fs.writeFileSync(outMap, JSON.stringify(mapeo, null, 2), 'utf-8');
console.log(`\nMapeo guardado en: ${outMap}`);
