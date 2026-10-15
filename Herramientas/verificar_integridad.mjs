// verificar_integridad.mjs — GUARDIAN DEL PIPELINE (sin llamadas a la API, gratis)
//
// Comprueba, para cada .txt traducido frente a su original:
//   1. Conjunto de indices identico (no basta con contar marcadores)
//   2. Entradas ausentes que tenian texto real   -> BLOQUEANTE (desplaza los IDs)
//   3. Entradas de mas que no existen en original -> BLOQUEANTE
//   4. Etiquetas <CLT>/<PAD>/<DIG>/<RUBY> conservadas una a una
//   5. Tipograficos INTRODUCIDOS por el modelo (si el original ya usaba "—",
//      conservarlo es CORRECTO y no se marca como error)
//   6. Entradas que perdieron el salto de linea interno (riesgo de desborde)
//
// Uso:
//   node verificar_integridad.mjs <dir_original> <dir_traducido>
//
// Devuelve exit code 1 si hay archivos bloqueantes, para poder encadenarlo
// antes de reempaquetar:  && node stx_repack_v2.mjs ...

import fs from 'fs';
import path from 'path';

function parseBloques(txt) {
  const partes = txt.replace(/\r\n/g, '\n').split(/^#####[ \t]*(\d+)[ \t]*\n?/m);
  const mapa = new Map();
  for (let i = 1; i + 1 < partes.length; i += 2) {
    const idx = parseInt(partes[i], 10);
    if (Number.isNaN(idx)) continue;
    let s = partes[i + 1] ?? '';
    if (s.endsWith('\n\n')) s = s.slice(0, -2);
    else if (s.endsWith('\n')) s = s.slice(0, -1);
    mapa.set(idx, s);
  }
  return mapa;
}

const TAGS = /<(CLT|PAD|DIG|RUBY)=[^>]*>/g;
const TIPOGRAFICOS = {
  'comilla doble tipografica': /[\u201C\u201D]/g,
  'comilla simple tipografica': /[\u2018\u2019]/g,
  'guion largo': /\u2014/g,
  'puntos suspensivos unicode': /\u2026/g
};

function contarTags(s) {
  const m = s.match(TAGS) || [];
  const c = {};
  for (const t of m) c[t] = (c[t] || 0) + 1;
  return c;
}

const origDir = process.argv[2];
const tradDir = process.argv[3];
if (!origDir || !tradDir) {
  console.error('Uso: node verificar_integridad.mjs <dir_original> <dir_traducido>');
  process.exit(1);
}

const origFiles = fs.readdirSync(origDir).filter(f => f.toLowerCase().endsWith('.txt')).sort();

const resumen = { ok: 0, bloqueantes: [], avisos: [], faltantes: [] };
let totalEntradas = 0, totalPerdidas = 0, totalSinSalto = 0, totalTagsRotos = 0, totalCharsMalos = 0;

for (const f of origFiles) {
  const tradPath = path.join(tradDir, f);
  if (!fs.existsSync(tradPath)) { resumen.faltantes.push(f); continue; }

  const A = parseBloques(fs.readFileSync(path.join(origDir, f), 'utf-8'));
  const B = parseBloques(fs.readFileSync(tradPath, 'utf-8'));
  totalEntradas += A.size;

  const idxB = new Set(B.keys());
  const ausentes = [...A.keys()].filter(k => !idxB.has(k));
  const conTexto = ausentes.filter(k => A.get(k).trim() !== '');
  const extra = [...idxB].filter(k => !A.has(k));

  let tagsRotos = 0, charsMalos = 0, sinSalto = 0;
  const detalleTags = [], detalleChars = [];

  for (const k of A.keys()) {
    if (!idxB.has(k)) continue;
    const o = A.get(k), t = B.get(k);

    const co = contarTags(o), ct = contarTags(t);
    for (const tag of new Set([...Object.keys(co), ...Object.keys(ct)])) {
      if ((co[tag] || 0) !== (ct[tag] || 0)) {
        tagsRotos++;
        if (detalleTags.length < 3) detalleTags.push(`[${k}] ${tag}: ${co[tag] || 0} -> ${ct[tag] || 0}`);
      }
    }

    for (const [nombre, re] of Object.entries(TIPOGRAFICOS)) {
      const nOrig = (o.match(re) || []).length;
      const nTrad = (t.match(re) || []).length;
      if (nTrad > nOrig) {
        charsMalos += nTrad - nOrig;
        if (detalleChars.length < 3) detalleChars.push(`[${k}] ${nombre}: ${nOrig} -> ${nTrad}`);
      }
    }

    if (/[\r\n]/.test(o) && !/[\r\n]/.test(t)) sinSalto++;
  }

  totalPerdidas += conTexto.length;
  totalSinSalto += sinSalto;
  totalTagsRotos += tagsRotos;
  totalCharsMalos += charsMalos;

  if (conTexto.length > 0 || extra.length > 0) {
    resumen.bloqueantes.push({
      f, entradasOrig: A.size, entradasTrad: B.size,
      perdidasConTexto: conTexto.length, extras: extra.length,
      primerosPerdidos: conTexto.slice(0, 3)
    });
  } else {
    resumen.ok++;
  }

  if (tagsRotos || charsMalos || sinSalto > 3) {
    resumen.avisos.push({ f, tagsRotos, charsMalos, sinSalto, detalleTags, detalleChars });
  }
}

console.log('='.repeat(84));
console.log('VERIFICACION DE INTEGRIDAD DE LA TRADUCCION');
console.log('='.repeat(84));
console.log(`Original : ${origDir}`);
console.log(`Traducido: ${tradDir}`);
console.log('');
console.log(`Archivos originales         : ${origFiles.length}`);
console.log(`Entradas totales            : ${totalEntradas}`);
console.log(`Archivos correctos          : ${resumen.ok}`);
console.log(`Archivos BLOQUEANTES        : ${resumen.bloqueantes.length}`);
console.log(`Archivos ausentes           : ${resumen.faltantes.length}`);
console.log(`Entradas perdidas con texto : ${totalPerdidas}`);
console.log(`Entradas de mas             : ${resumen.bloqueantes.reduce((a, b) => a + b.extras, 0)}`);
console.log(`Etiquetas desajustadas      : ${totalTagsRotos}`);
console.log(`Tipograficos introducidos   : ${totalCharsMalos}`);
console.log(`Saltos de linea perdidos    : ${totalSinSalto}`);
console.log('');

if (resumen.bloqueantes.length) {
  console.log('*** BLOQUEANTES: NO reempaquetar estos archivos ***');
  for (const b of resumen.bloqueantes) {
    console.log(`  ${b.f}`);
    console.log(`     entradas: ${b.entradasOrig} -> ${b.entradasTrad}   perdidas con texto: ${b.perdidasConTexto}   de mas: ${b.extras}`);
    if (b.primerosPerdidos.length) console.log(`     primeros indices perdidos: ${b.primerosPerdidos.join(', ')}`);
  }
  console.log('');
}

if (resumen.avisos.length) {
  console.log('--- AVISOS (no bloquean, pero revisar) ---');
  for (const a of resumen.avisos) {
    console.log(`  ${a.f}: tags=${a.tagsRotos} tipograficos=${a.charsMalos} saltosPerdidos=${a.sinSalto}`);
    for (const d of a.detalleTags) console.log(`      ${d}`);
    for (const d of a.detalleChars) console.log(`      ${d}`);
  }
  console.log('');
}

if (resumen.faltantes.length) {
  console.log(`--- AUSENTES (${resumen.faltantes.length}) ---`);
  for (const f of resumen.faltantes.slice(0, 20)) console.log(`  ${f}`);
  console.log('');
}

const ok = resumen.bloqueantes.length === 0 && resumen.faltantes.length === 0;
console.log(ok
  ? '>>> OK: todos los archivos son seguros para reempaquetar.'
  : `>>> ABORTAR: ${resumen.bloqueantes.length} bloqueante(s), ${resumen.faltantes.length} ausente(s).`);
process.exit(ok ? 0 : 1);
