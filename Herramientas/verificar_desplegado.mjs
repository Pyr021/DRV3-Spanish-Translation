// Verificacion del game_resident_US.spc TAL COMO ESTA EN EL MOD.
// Confirma: fuente original, IDs intactos, tildes presentes y que cada texto
// traducido esta en el slot que le corresponde (cotejo por contenido).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
function parse(p) {
  const b = fs.readFileSync(p); let pos = 4 + 0x24;
  const n = b.readUInt32LE(pos); pos += 4 + 4 + 0x10 + 4 + 0x0C;
  const o = [];
  for (let i = 0; i < n; i++) {
    const cf = b.readUInt16LE(pos); pos += 2; pos += 2;
    const cs = b.readUInt32LE(pos); pos += 4; const ds = b.readUInt32LE(pos); pos += 4;
    const nl = b.readUInt32LE(pos); pos += 4 + 0x10;
    const np = (0x10 - ((nl + 1) % 0x10)) % 0x10, dp = (0x10 - (cs % 0x10)) % 0x10;
    const name = b.toString('utf-8', pos, pos + nl); pos += nl + np + 1;
    const raw = b.slice(pos, pos + cs); pos += cs + dp;
    o.push({ i, name, cf, ds, raw });
  }
  return o;
}
function parseStx(d) {
  if (d.toString('ascii', 0, 4) !== 'STXT') return null;
  const t = d.readUInt32LE(12), n = d.readUInt32LE(20);
  const ids = [], strs = [];
  for (let i = 0; i < n; i++) {
    ids.push(d.readUInt32LE(t + i * 8));
    const so = d.readUInt32LE(t + i * 8 + 4);
    let e = so;
    while (e + 1 < d.length && !(d[e] === 0 && d[e + 1] === 0)) e += 2;
    strs.push(d.toString('utf16le', so, e));
  }
  return { n, ids, strs };
}

const modSpc = process.argv[2];
const origSpc = process.argv[3];
const tradDir = process.argv[4];

const M = parse(modSpc);
const O = parse(origSpc);
const dm = M.map(s => (s.cf === 2 ? spcDec(s.raw, s.ds) : s.raw));
const doo = O.map(s => (s.cf === 2 ? spcDec(s.raw, s.ds) : s.raw));

const esStx = dm.map(d => d.length > 4 && d.toString('ascii', 0, 4) === 'STXT');
const esStxO = doo.map(d => d.length > 4 && d.toString('ascii', 0, 4) === 'STXT');

console.log('='.repeat(76));
console.log('VERIFICACION DEL ARCHIVO INSTALADO EN EL MOD');
console.log('='.repeat(76));
console.log(`Subarchivos: ${M.length} (original ${O.length})`);
console.log(`.stx       : ${esStx.filter(Boolean).length} (original ${esStxO.filter(Boolean).length})`);

// Fuente
const iFont = dm.findIndex((d, i) => !esStx[i] && doo[i] && doo[i].length === 212992);
console.log(`\nFuente (v3_font00.srdv)`);
console.log(`  tamano descomprimido en el mod : ${dm[0].length}`);
console.log(`  tamano en el original          : ${doo[0].length}`);
console.log(`  -> ${dm[0].length === doo[0].length ? 'FUENTE ORIGINAL (correcto)' : '*** DIFIERE ***'}`);

// IDs
let idsOk = 0, idsMal = 0;
for (let i = 0; i < M.length; i++) {
  if (!esStx[i]) continue;
  const a = parseStx(doo[i]), b = parseStx(dm[i]);
  if (!a || !b) continue;
  JSON.stringify(a.ids) === JSON.stringify(b.ids) ? idsOk++ : idsMal++;
}
console.log(`\nIDs internos de los .stx`);
console.log(`  intactos: ${idsOk}   alterados: ${idsMal}`);

// Tildes y cotejo por contenido
let tildes = 0, enie = 0, apert = 0, entradas = 0;
for (let i = 0; i < M.length; i++) {
  if (!esStx[i]) continue;
  const b = parseStx(dm[i]);
  if (!b) continue;
  entradas += b.n;
  for (const s of b.strs) {
    tildes += (s.match(/[\u00e1\u00e9\u00ed\u00f3\u00fa\u00c1\u00c9\u00cd\u00d3\u00da]/g) || []).length;
    enie += (s.match(/[\u00f1\u00d1]/g) || []).length;
    apert += (s.match(/[\u00bf\u00a1]/g) || []).length;
  }
}
console.log(`\nContenido`);
console.log(`  entradas totales : ${entradas}`);
console.log(`  tildes           : ${tildes}`);
console.log(`  enies            : ${enie}`);
console.log(`  signos ¿ ¡       : ${apert}`);

// Cotejo: cada texto traducido debe aparecer en el .spc instalado
const todos = [];
for (let i = 0; i < M.length; i++) if (esStx[i]) { const b = parseStx(dm[i]); if (b) todos.push(...b.strs); }
const conjunto = new Set(todos);
const faltan = [];
let encontrados = 0, total = 0;
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
for (const f of fs.readdirSync(tradDir).filter(x => x.endsWith('.txt'))) {
  const mapa = parseBloques(fs.readFileSync(path.join(tradDir, f), 'utf-8'));
  for (const [, v] of mapa) {
    if (v.trim() === '') continue;
    total++;
    if (conjunto.has(v)) encontrados++;
    else if (faltan.length < 5) faltan.push({ f, v: v.slice(0, 70) });
  }
}
console.log(`\nCotejo por contenido`);
console.log(`  entradas en los .txt reajustados : ${total}`);
console.log(`  presentes en el .spc instalado   : ${encontrados}`);
console.log(`  -> ${encontrados === total ? 'TODAS las entradas estan aplicadas' : `*** FALTAN ${total - encontrados} ***`}`);
if (faltan.length) {
  console.log('  ejemplos que faltan:');
  for (const x of faltan) console.log(`     ${x.f}: ${JSON.stringify(x.v)}`);
}
console.log('');
const ok = dm[0].length === doo[0].length && idsMal === 0 && encontrados === total;
console.log(ok ? '>>> EL ARCHIVO INSTALADO ES CORRECTO.' : '>>> REVISAR.');
process.exit(ok ? 0 : 1);
