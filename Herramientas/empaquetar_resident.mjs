// empaquetar_resident.mjs — empaqueta game_resident_US.spc de forma CORRECTA.
//
// Diferencia clave frente a un empaquetado por posicion: el .spc de
// game_resident tiene la tabla SIN NOMBRES, y su orden NO es el alfabetico
// (los Anagram/BrainDrive/Imagination van al final). Emparejar por posicion
// mete cada texto en el archivo equivocado.
//
// Aqui el emparejamiento se hace POR CONTENIDO: la primera cadena de cada slot
// se compara con el primer bloque del .txt correspondiente, y se guarda el
// mapeo verificado.
//
//   node empaquetar_resident.mjs <spc_original> <dir_txt_referencia> <dir_txt_aplicar> <spc_salida>
//
// <dir_txt_referencia> = game_resident_txt (los .txt ingleses originales)
// <dir_txt_aplicar>    = los .txt traducidos (reajustados o no) que se inyectan

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spcCmp } from './spc_cmp.mjs';

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
    o.push({ i, name, cf, uf, ds, raw });
  }
  return o;
}
function packSpc(subs, outPath) {
  const parts = [];
  parts.push(Buffer.from('CPS.', 'ascii'));
  const unk1 = Buffer.alloc(0x24, 0);
  for (let k = 4; k <= 11; k++) unk1[k] = 0xFF;
  parts.push(unk1);
  const fc = Buffer.alloc(4); fc.writeUInt32LE(subs.length); parts.push(fc);
  const u2 = Buffer.alloc(4); u2.writeUInt32LE(4); parts.push(u2);
  parts.push(Buffer.alloc(0x10, 0));
  parts.push(Buffer.from('Root', 'ascii'));
  parts.push(Buffer.alloc(0x0C, 0));
  for (const sf of subs) {
    let stored, cmpFlag;
    if (sf.uf === 1 || sf.cf === 1) { stored = sf.data; cmpFlag = 1; }
    else { stored = spcCmp(sf.data); cmpFlag = 2; }
    const nameBuf = Buffer.from(sf.name, 'utf-8');
    const np = (0x10 - ((nameBuf.length + 1) % 0x10)) % 0x10;
    const dp = (0x10 - (stored.length % 0x10)) % 0x10;
    const h = Buffer.alloc(0x20);
    h.writeUInt16LE(cmpFlag, 0);
    h.writeUInt16LE(sf.uf, 2);
    h.writeUInt32LE(stored.length, 4);
    h.writeUInt32LE(sf.data.length, 8);
    h.writeUInt32LE(nameBuf.length, 12);
    parts.push(h, nameBuf, Buffer.alloc(np + 1, 0), stored, Buffer.alloc(dp, 0));
  }
  fs.writeFileSync(outPath, Buffer.concat(parts));
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
  return { t, n, ids, strs };
}
function primerTexto(d) {
  const i = parseStx(d); if (!i) return null;
  for (const s of i.strs) if (s.trim() !== '') return s.slice(0, 200);
  return null;
}

const [spcPath, refDir, aplicarDir, outPath] = process.argv.slice(2);
if (!spcPath || !refDir || !aplicarDir || !outPath) {
  console.error('Uso: node empaquetar_resident.mjs <spc_original> <dir_txt_referencia> <dir_txt_aplicar> <spc_salida>');
  process.exit(1);
}

console.log('PASO 1: leyendo el .spc original');
const subs = parseSpc(spcPath);
const datos = subs.map(s => (s.cf === 2 ? spcDec(s.raw, s.ds) : s.raw));
const esStx = datos.map(d => d.length > 4 && d.toString('ascii', 0, 4) === 'STXT');
console.log(`  ${subs.length} subarchivos, ${esStx.filter(Boolean).length} son .stx`);

console.log('\nPASO 2: identificando cada slot .stx POR CONTENIDO');
const refs = new Map();
for (const f of fs.readdirSync(refDir).filter(x => x.endsWith('.txt'))) {
  const m = parseBloques(fs.readFileSync(path.join(refDir, f), 'utf-8'));
  const p = [...m.entries()].find(([, v]) => v.trim() !== '');
  if (p) refs.set(f, p[1].slice(0, 200));
}
const mapeo = {};
const usados = new Set();
for (let i = 0; i < subs.length; i++) {
  if (!esStx[i]) continue;
  const pt = primerTexto(datos[i]);
  let elegido = null;
  for (const [f, p] of refs) if (!usados.has(f) && p === pt) { elegido = f; break; }
  if (!elegido) for (const [f, p] of refs) if (!usados.has(f) && pt && p.slice(0, 60) === pt.slice(0, 60)) { elegido = f; break; }
  if (elegido) { mapeo[i] = elegido; usados.add(elegido); }
}
const sinMap = esStx.map((v, i) => (v && !mapeo[i] ? i : -1)).filter(i => i >= 0);
console.log(`  identificados: ${Object.keys(mapeo).length}/${esStx.filter(Boolean).length}`);
if (sinMap.length) { console.log(`  SIN IDENTIFICAR: slots ${sinMap.join(', ')}`); process.exit(1); }

console.log('\nPASO 3: aplicando los textos traducidos');
let aplicados = 0;
const nuevos = datos.map((d, i) => {
  if (!esStx[i]) return d;
  const nombre = mapeo[i];
  const p = path.join(aplicarDir, nombre);
  if (!fs.existsSync(p)) { console.log(`  !! falta ${nombre}, se deja el original`); return d; }
  const info = parseStx(d);
  const mapa = parseBloques(fs.readFileSync(p, 'utf-8'));

  const tableOff = 0x20;
  const bufs = [], offs = [];
  let cur = tableOff + info.n * 8;
  for (let k = 0; k < info.n; k++) {
    offs.push(cur);
    const v = mapa.has(k) ? mapa.get(k) : info.strs[k];
    const b = Buffer.concat([Buffer.from(v, 'utf16le'), Buffer.from([0, 0])]);
    bufs.push(b); cur += b.length;
  }
  const h = Buffer.alloc(32);
  h.write('STXT', 0, 'ascii'); h.write('JPLL', 4, 'ascii');
  h.writeUInt32LE(0x01, 8); h.writeUInt32LE(tableOff, 12);
  h.writeUInt32LE(0x08, 16); h.writeUInt32LE(info.n, 20);
  const t = [];
  for (let k = 0; k < info.n; k++) {
    const e = Buffer.alloc(8);
    e.writeUInt32LE(info.ids[k], 0);
    e.writeUInt32LE(offs[k], 4);
    t.push(e);
  }
  aplicados++;
  return Buffer.concat([h, ...t, ...bufs]);
});
console.log(`  ${aplicados} archivos .stx reconstruidos`);

console.log('\nPASO 4: empaquetando');
const t0 = Date.now();
packSpc(subs.map((s, i) => ({ name: s.name, uf: s.uf, cf: s.cf, data: nuevos[i] })), outPath);
console.log(`  hecho en ${((Date.now() - t0) / 1000).toFixed(1)}s`);

console.log('\nPASO 5: verificando el .spc generado');
const reSubs = parseSpc(outPath);
const reDatos = reSubs.map(s => (s.cf === 2 ? spcDec(s.raw, s.ds) : s.raw));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
let noStxOk = 0, noStxMal = 0, idsOk = 0, idsMal = 0, txtOk = 0, txtMal = 0;
for (let i = 0; i < reSubs.length; i++) {
  if (!esStx[i]) { sha(reDatos[i]) === sha(datos[i]) ? noStxOk++ : noStxMal++; continue; }
  const a = parseStx(datos[i]), b = parseStx(reDatos[i]);
  if (!b) { idsMal++; continue; }
  JSON.stringify(a.ids) === JSON.stringify(b.ids) ? idsOk++ : idsMal++;
  const mapa = parseBloques(fs.readFileSync(path.join(aplicarDir, mapeo[i]), 'utf-8'));
  let ok = true;
  for (let k = 0; k < b.n; k++) if (b.strs[k] !== (mapa.has(k) ? mapa.get(k) : a.strs[k])) { ok = false; break; }
  ok ? txtOk++ : txtMal++;
}
console.log(`  subarchivos           : ${reSubs.length} (original ${subs.length})`);
console.log(`  NO-STX byte-identicos : ${noStxOk}   distintos: ${noStxMal}`);
console.log(`  .stx con IDs intactos : ${idsOk}   mal: ${idsMal}`);
console.log(`  .stx con texto correcto en su slot: ${txtOk}   mal: ${txtMal}`);
const todoOk = noStxMal === 0 && idsMal === 0 && txtMal === 0 && reSubs.length === subs.length;
console.log('');
console.log(todoOk ? `>>> CORRECTO. Generado: ${outPath}` : '>>> FALLIDO: revisar.');
console.log(`   tamano: ${fs.statSync(outPath).size} bytes (original ${fs.statSync(spcPath).size})`);
process.exit(todoOk ? 0 : 1);
