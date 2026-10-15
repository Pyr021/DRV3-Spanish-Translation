// pipeline_todos.mjs — aplica el pipeline v4 a todos los .SPC de texto de wrd_script/007,
// uno detrás de otro, verificando cada paso. Se lanza con pipeline_todos.cmd.
//
// Por cada SPC:
//   1. extrae el original inglés del CPK   -> stx_en/  -> txt/      (referencia e IDs)
//   2. extrae el del mod actual            -> stx_mod/ -> trad/     (traducción a corregir)
//   3. comprueba que mod y original tienen los mismos .stx y las mismas entradas
//   4. (--retraducir) retraduce desde el inglés los archivos sin tildes (usa la API)
//   5. verificar_ortografia --corregir --probables                   -> trad_corr/
//   6. reajustar_saltos (3 líneas)                                    -> trad_reaj/
//   7. verificar_integridad (bloques y etiquetas intactos)
//   8. stx_repack_v2 (IDs del original)                               -> stx_new/
//   9. comprueba cada .stx nuevo: nº de entradas, IDs y textos
//  10. spc_repack_generic_v3 (orden del original) y lo verifica extrayéndolo otra vez
//  11. copia de seguridad del SPC del mod y copia del nuevo (comprueba que es idéntico)
// Si algo falla: se detiene, NO toca el mod para ese SPC y lo apunta en el log.
//
// Opciones:
//   --solo chap0,chap3     solo esos (nombres sin "_text_US.SPC")
//   --desde chap4          empieza en ese (para reanudar)
//   --simular              hace todo menos copiar al mod
//   --retraducir           paso 4 (necesita DEEPSEEK_API_KEY; cuesta dinero)
//   --sin-probables        corrige solo los errores "seguros"
//   --trabajo DIR          carpeta de trabajo (def. C:\Users\david\Desktop\todos_work)

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------- configuración
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BASE = fs.existsSync(path.join(AQUI, 'stx_repack_v2.mjs')) ? AQUI : path.resolve(AQUI, '..');
const CPK_ORIG = 'C:\\Users\\david\\Desktop\\hgy\\CriPakTools_x64\\partition_data_win_us.cpk_unpacked\\wrd_script\\007';
const MOD = 'C:\\Users\\david\\Desktop\\Reloaded2\\Release\\Mods\\CriFs.V2.Hook\\CRIFsV2Hook\\CPK\\partition_data_win_us.cpk\\wrd_script\\007';
const BACKUP_RAIZ = 'C:\\Users\\david\\Desktop\\BACKUP_DanganronpaV3_Esp';
const TODOS = ['chap0', 'chap1', 'chap3', 'chap4', 'chap5', 'chap6', 'chap7', 'ainori', 'gallery', 'sub_routine', 'test'];

const args = process.argv.slice(2);
const op = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const SIMULAR = args.includes('--simular');
const RETRADUCIR = args.includes('--retraducir');
const PROBABLES = !args.includes('--sin-probables');
const TRABAJO = path.resolve(op('--trabajo') || 'C:\\Users\\david\\Desktop\\todos_work');
let lista = op('--solo') ? op('--solo').split(',').map(s => s.trim()) : TODOS;
if (op('--desde')) { const k = lista.indexOf(op('--desde')); if (k < 0) salir(`--desde ${op('--desde')} no está en la lista`); lista = lista.slice(k); }

const SELLO = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
const BACKUP = path.join(BACKUP_RAIZ, `pipeline_todos_${SELLO}`);
const LOG = path.join(TRABAJO, '_pipeline_todos_log.txt');

// ---------------------------------------------------------------- utilidades
fs.mkdirSync(TRABAJO, { recursive: true });
function log(s = '') { console.log(s); fs.appendFileSync(LOG, s + '\n', 'utf-8'); }
function salir(msg) { console.error(msg); process.exit(1); }
class Fallo extends Error {}
const falla = (m) => { throw new Fallo(m); };

function ejecutar(script, argumentos, { mostrar = false, permitirFallo = false, salida } = {}) {
  const ruta = [AQUI, BASE].map(d => path.join(d, script)).find(p => fs.existsSync(p));
  if (!ruta) falla(`no encuentro ${script} ni en ${AQUI} ni en ${BASE}`);
  const r = spawnSync(process.execPath, [ruta, ...argumentos], { encoding: 'utf-8', stdio: mostrar ? 'inherit' : 'pipe', maxBuffer: 256 * 1024 * 1024 });
  const texto = (r.stdout || '') + (r.stderr || '');
  if (salida) fs.appendFileSync(salida, `\n$ node ${script} ${argumentos.join(' ')}\n${texto}`, 'utf-8');
  if (r.status !== 0 && !permitirFallo) falla(`${script} terminó con código ${r.status}\n${texto.split('\n').slice(-15).join('\n')}`);
  return { codigo: r.status, texto };
}
const contar = (dir, ext) => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(ext) && !f.startsWith('_')).length : 0;
const hash = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// tabla de un SPC (solo lectura): nombres en orden
function nombresSpc(p) {
  const b = fs.readFileSync(p);
  if (b.toString('ascii', 0, 4) !== 'CPS.') falla(`${p} no es un SPC`);
  let pos = 4 + 0x24; const n = b.readUInt32LE(pos); pos += 4 + 4 + 0x10 + 4 + 0x0C;
  const out = [];
  for (let i = 0; i < n; i++) {
    pos += 4; const cs = b.readUInt32LE(pos); pos += 8; const nl = b.readUInt32LE(pos); pos += 4 + 0x10;
    out.push(b.toString('utf8', pos, pos + nl));
    pos += nl + (0x10 - (nl + 1) % 0x10) % 0x10 + 1 + cs + (0x10 - cs % 0x10) % 0x10;
  }
  return out;
}
// un .stx: ids y cadenas
function leerStx(p) {
  const b = fs.readFileSync(p);
  if (b.toString('ascii', 0, 4) !== 'STXT') falla(`${p} no es STX`);
  const t = b.readUInt32LE(12), n = b.readUInt32LE(20);
  const ids = [], s = [];
  for (let i = 0; i < n; i++) {
    ids.push(b.readUInt32LE(t + i * 8));
    const o = b.readUInt32LE(t + i * 8 + 4); let e = o;
    while (e + 1 < b.length && !(b[e] === 0 && b[e + 1] === 0)) e += 2;
    s.push(b.toString('utf16le', o, e));
  }
  return { ids, s };
}
// bloques de un .txt (mismo criterio que stx_repack_v2)
function leerTxt(p) {
  const parts = fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n').split(/^##### /m);
  const out = [];
  for (let i = 1; i < parts.length; i++) {
    const nl = parts[i].indexOf('\n'); if (nl < 0) continue;
    let t = parts[i].slice(nl + 1);
    if (t.endsWith('\n\n')) t = t.slice(0, -2); else if (t.endsWith('\n')) t = t.slice(0, -1);
    out[parseInt(parts[i].slice(0, nl), 10)] = t;
  }
  return out;
}
const num = (re, texto) => { const m = re.exec(texto); return m ? parseInt(m[1], 10) : null; };
// Los informes (_informe_*.txt, _sin_tildes.txt...) no son textos del juego: se apartan a
// <capítulo>\_informes\ para que ningún script los procese como si fueran un .stx.
function apartarInformes(dir, W) {
  if (!fs.existsSync(dir)) return 0;
  const dest = path.join(W, '_informes');
  let n = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith('_'))) {
    fs.mkdirSync(dest, { recursive: true });
    fs.renameSync(path.join(dir, f), path.join(dest, `${path.basename(dir)}${f}`));
    n++;
  }
  return n;
}
const validos = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.txt') && !f.startsWith('_')) : [];

// ---------------------------------------------------------------- un capítulo
function procesar(nombre) {
  const spc = `${nombre}_text_US.SPC`;
  const orig = path.join(CPK_ORIG, spc);
  const enMod = path.join(MOD, spc);
  const W = path.join(TRABAJO, nombre);
  const salida = path.join(W, '_salida_scripts.txt');
  const r = { spc };
  if (!fs.existsSync(orig)) falla(`no existe el original ${orig}`);
  if (!fs.existsSync(enMod)) falla(`no existe en el mod ${enMod}`);
  if (!path.resolve(W).startsWith(TRABAJO + path.sep)) falla(`carpeta de trabajo fuera de ${TRABAJO}`);
  fs.rmSync(W, { recursive: true, force: true });
  fs.mkdirSync(W, { recursive: true });
  const d = (x) => path.join(W, x);

  // 1-2. extraer original y mod
  const nOrig = nombresSpc(orig), nMod = nombresSpc(enMod);
  r.stx = nOrig.length;
  ejecutar('spc_extract.mjs', [orig, d('stx_en')], { salida });
  ejecutar('stx_extract.mjs', [d('stx_en'), d('txt')], { salida });
  ejecutar('spc_extract.mjs', [enMod, d('stx_mod')], { salida });
  ejecutar('stx_extract.mjs', [d('stx_mod'), d('trad')], { salida });
  // 3. conteos y emparejamiento
  const cuentas = { stx_en: contar(d('stx_en'), '.stx'), txt: contar(d('txt'), '.txt'), stx_mod: contar(d('stx_mod'), '.stx'), trad: contar(d('trad'), '.txt') };
  for (const [k, v] of Object.entries(cuentas)) if (v !== r.stx) falla(`${k}: ${v} archivos, se esperaban ${r.stx}`);
  const setMod = new Set(nMod);
  const faltan = nOrig.filter(x => !setMod.has(x));
  if (faltan.length || nMod.length !== nOrig.length) falla(`el SPC del mod no tiene los mismos .stx que el original (faltan: ${faltan.slice(0, 5).join(', ')})`);
  r.ordenMod = nOrig.every((x, i) => x === nMod[i]) ? 'igual' : 'distinto (se corrige al reempaquetar)';
  let entradas = 0;
  for (const f of nOrig) {
    const a = leerStx(path.join(d('stx_en'), f)), b = leerStx(path.join(d('stx_mod'), f));
    if (a.s.length !== b.s.length) falla(`${f}: el mod tiene ${b.s.length} entradas y el original ${a.s.length}`);
    entradas += a.s.length;
  }
  r.entradas = entradas;
  ejecutar('verificar_integridad.mjs', [d('txt'), d('trad')], { salida });

  // 4. retraducción opcional de los archivos sin tildes
  let fuente = d('trad');
  const listado = ejecutar('retraducir_sin_tildes.mjs', [d('txt'), d('trad'), d('trad_retrad'), path.join(BASE, 'glosario.txt'), '--solo-listar'], { salida });
  r.sinTildes = num(/Archivos sin tildes: (\d+)/, listado.texto) ?? 0;
  if (RETRADUCIR && r.sinTildes > 0) {
    log(`   retraduciendo ${r.sinTildes} archivos sin tildes desde el inglés (API)...`);
    ejecutar('retraducir_sin_tildes.mjs', [d('txt'), d('trad'), d('trad_retrad'), path.join(BASE, 'glosario.txt')], { mostrar: true });
    if (contar(d('trad_retrad'), '.txt') !== r.stx) falla(`trad_retrad: ${contar(d('trad_retrad'), '.txt')} archivos, se esperaban ${r.stx}`);
    fuente = d('trad_retrad');
    r.retraducidos = r.sinTildes;
  }

  // 5. ortografía
  const corr = ejecutar('verificar_ortografia.mjs', [fuente, '--original', d('txt'), '--corregir', d('trad_corr'), ...(PROBABLES ? ['--probables'] : [])], { salida });
  r.antes = {
    seguros: num(/seguros: (\d+)/, corr.texto), probables: num(/probables: (\d+)/, corr.texto),
    dudosos: num(/dudosos: (\d+)/, corr.texto), bloques: num(/Corregidos \(bloques con cambios\): (\d+)/, corr.texto),
  };
  apartarInformes(d('trad_corr'), W);
  if (contar(d('trad_corr'), '.txt') !== r.stx) falla(`trad_corr: ${contar(d('trad_corr'), '.txt')} archivos, se esperaban ${r.stx}`);

  // 6. reajuste
  const re = ejecutar('reajustar_saltos.mjs', [d('txt'), d('trad_corr'), d('trad_reaj')], { salida });
  r.noCaben = num(/NO CABEN \(revisar a mano\)\s*: (\d+)/, re.texto);
  if (num(/Palabras alteradas sin aviso : (\d+)/, re.texto)) falla('reajustar_saltos alteró palabras');
  if (contar(d('trad_reaj'), '.txt') !== r.stx) falla(`trad_reaj: ${contar(d('trad_reaj'), '.txt')} archivos, se esperaban ${r.stx}`);

  // 7. integridad final
  ejecutar('verificar_integridad.mjs', [d('txt'), d('trad_reaj')], { salida });
  const fin = ejecutar('verificar_ortografia.mjs', [d('trad_reaj'), '--original', d('txt'), '--no-bloquear', '--informe', d('_informe_ortografia.txt')], { salida });
  r.despues = { seguros: num(/seguros: (\d+)/, fin.texto), probables: num(/probables: (\d+)/, fin.texto), dudosos: num(/dudosos: (\d+)/, fin.texto), sinTildes: num(/sin tildes: (\d+)/, fin.texto) };

  // 8-9. stx con los IDs del original, comprobados uno a uno
  apartarInformes(d('trad_reaj'), W);
  const aEmpaquetar = validos(d('trad_reaj')).length;
  if (aEmpaquetar !== r.stx) falla(`trad_reaj: ${aEmpaquetar} .txt válidos, se esperaban ${r.stx}`);
  const rep = ejecutar('stx_repack_v2.mjs', [d('trad_reaj'), d('stx_en'), d('stx_new')], { salida });
  const okRep = num(/Listo\. (\d+) OK/, rep.texto), malRep = num(/OK, (\d+) fallos/, rep.texto);
  // stx_repack_v2 cuenta como "fallo" cualquier .txt sin .stx original; si es un informe "_..." no lo es
  const skipsInforme = [...rep.texto.matchAll(/^SKIP ([^:]+):/gm)].filter(m => path.basename(m[1]).startsWith('_')).length;
  const fallosReales = (malRep ?? 0) - skipsInforme;
  if (okRep !== aEmpaquetar || fallosReales !== 0) falla(`stx_repack_v2: ${okRep} OK, ${fallosReales} fallos reales (se esperaban ${aEmpaquetar} OK)`);
  if (contar(d('stx_new'), '.stx') !== r.stx) falla(`stx_new: ${contar(d('stx_new'), '.stx')} .stx, se esperaban ${r.stx}`);
  const tags = (s) => (s.match(/<(?:CLT|PAD|DIG|RUBY)=[^>]*>/g) || []).sort().join('|');
  r.tagsDistintos = [];
  for (const f of nOrig) {
    const a = leerStx(path.join(d('stx_en'), f));
    const b = leerStx(path.join(d('stx_new'), f));
    b.s.forEach((x, i) => { if (tags(x) !== tags(a.s[i] ?? '')) r.tagsDistintos.push(`${f}#${i}`); });
    const t = leerTxt(path.join(d('trad_reaj'), f.replace(/\.stx$/i, '.txt')));
    if (b.s.length !== a.s.length) falla(`${f}: el .stx nuevo tiene ${b.s.length} entradas y el original ${a.s.length}`);
    if (b.ids.some((x, i) => x !== a.ids[i])) falla(`${f}: los IDs no coinciden con el original`);
    if (b.s.some((x, i) => x !== (t[i] ?? ''))) falla(`${f}: el texto del .stx no coincide con el .txt reajustado`);
  }
  r.etapas = { stx_en: cuentas.stx_en, txt: cuentas.txt, stx_mod: cuentas.stx_mod, trad: cuentas.trad,
    trad_corr: contar(d('trad_corr'), '.txt'), trad_reaj: contar(d('trad_reaj'), '.txt'), stx_new: contar(d('stx_new'), '.stx') };

  // 10. SPC en el orden del original + verificación por extracción
  const nuevo = path.join(W, spc);
  ejecutar('spc_repack_generic_v3.mjs', [d('stx_new'), orig, nuevo], { salida });
  const nNuevo = nombresSpc(nuevo);
  if (nNuevo.length !== nOrig.length || nNuevo.some((x, i) => x !== nOrig[i])) falla(`el SPC nuevo no tiene los ${nOrig.length} .stx en el orden del original`);
  const chk = fs.mkdtempSync(path.join(os.tmpdir(), 'spcchk-'));
  ejecutar('spc_extract.mjs', [nuevo, chk], { salida });
  const distintos = nOrig.filter(f => !fs.existsSync(path.join(chk, f)) || !fs.readFileSync(path.join(chk, f)).equals(fs.readFileSync(path.join(d('stx_new'), f))));
  fs.rmSync(chk, { recursive: true, force: true });
  if (distintos.length) falla(`el SPC nuevo, al extraerlo, difiere en: ${distintos.slice(0, 5).join(', ')}`);
  r.tam = { original: fs.statSync(orig).size, modAntes: fs.statSync(enMod).size, nuevo: fs.statSync(nuevo).size };

  // 11. backup + copia al mod
  if (SIMULAR) { r.mod = 'SIMULACIÓN: no se ha copiado al mod'; return r; }
  fs.mkdirSync(BACKUP, { recursive: true });
  const bk = path.join(BACKUP, spc);
  fs.copyFileSync(enMod, bk);
  if (hash(bk) !== hash(enMod)) falla('la copia de seguridad no coincide con el archivo del mod');
  fs.copyFileSync(nuevo, enMod);
  if (hash(enMod) !== hash(nuevo)) {
    fs.copyFileSync(bk, enMod);
    falla('el archivo copiado al mod no coincide; se ha restaurado la copia de seguridad');
  }
  r.mod = `copiado (copia de seguridad: ${bk})`;
  return r;
}

// ---------------------------------------------------------------- principal
log('='.repeat(78));
log(`PIPELINE TODOS — ${new Date().toLocaleString('es-ES')}${SIMULAR ? '   [SIMULACIÓN: no toca el mod]' : ''}`);
log(`Capítulos: ${lista.join(', ')}`);
log(`Retraducir sin tildes: ${RETRADUCIR ? 'SÍ (API)' : 'no'} | probables: ${PROBABLES ? 'sí' : 'no'} | trabajo: ${TRABAJO}`);
if (!SIMULAR) log(`Copias de seguridad: ${BACKUP}`);
log('='.repeat(78));
const prohib = ejecutarSeguro('comprobar_prohibidos.mjs', [BASE]);
if (prohib !== 0) { log('ALTO: limpiar_acentos.mjs / limpiar_mod.mjs siguen activos. Ejecuta: node comprobar_prohibidos.mjs .. --bloquear'); process.exit(1); }
if (RETRADUCIR && !process.env.DEEPSEEK_API_KEY) { log('ALTO: --retraducir necesita DEEPSEEK_API_KEY'); process.exit(1); }

function ejecutarSeguro(s, a) { try { return ejecutar(s, a, { permitirFallo: true }).codigo; } catch { return 1; } }

const avisos = [];
for (const [k, nombre] of lista.entries()) {
  const t0 = Date.now();
  log(`\n[${k + 1}/${lista.length}] ${nombre}_text_US.SPC`);
  let r;
  try {
    r = procesar(nombre);
  } catch (e) {
    log(`   *** FALLO: ${e.message}`);
    log(`   El mod NO se ha modificado para este archivo. Detalles: ${path.join(TRABAJO, nombre, '_salida_scripts.txt')}`);
    log(`   Se detiene aquí. Para reanudar cuando lo arregles:  pipeline_todos.cmd --desde ${nombre}`);
    process.exit(1);
  }
  log(`   conteos: ${Object.entries(r.etapas).map(([k, v]) => `${k} ${v}/${r.stx}`).join(' | ')}`);
  log(`   entradas: ${r.entradas} (iguales en original, mod y nuevo)  |  orden en el mod: ${r.ordenMod}`);
  log(`   ortografía antes:   seguros ${r.antes.seguros}, probables ${r.antes.probables}, dudosos ${r.antes.dudosos}  -> bloques corregidos: ${r.antes.bloques}`);
  log(`   ortografía después: seguros ${r.despues.seguros}, probables ${r.despues.probables}, dudosos ${r.despues.dudosos}`);
  log(`   archivos sin tildes: ${r.sinTildes}${r.retraducidos ? ` (retraducidos: ${r.retraducidos})` : ''}  |  no caben en la caja: ${r.noCaben}`);
  log(`   tamaño: original ${r.tam.original} | mod antes ${r.tam.modAntes} | nuevo ${r.tam.nuevo}`);
  log(`   mod: ${r.mod}   (${Math.round((Date.now() - t0) / 1000)} s)`);
  if (r.sinTildes && !r.retraducidos) avisos.push(`${nombre}: ${r.sinTildes} archivos sin tildes (solo corregidos, no retraducidos)`);
  if (r.tagsDistintos.length) {
    log(`   etiquetas distintas del inglés: ${r.tagsDistintos.length} entradas (ya venían así del mod): ${r.tagsDistintos.slice(0, 8).join(', ')}${r.tagsDistintos.length > 8 ? '...' : ''}`);
    avisos.push(`${nombre}: ${r.tagsDistintos.length} entradas con etiquetas <CLT>... distintas del inglés (revisar)`);
  }
  if (r.noCaben) avisos.push(`${nombre}: ${r.noCaben} entradas no caben en la caja (ver ${path.join(TRABAJO, nombre, '_informes', 'trad_reaj_informe_reajuste.txt')})`);
}
log(`\nTODO CORRECTO: ${lista.length} archivos procesados${SIMULAR ? ' (simulación)' : ' y copiados al mod'}.`);
if (avisos.length) { log('AVISOS (no bloquean):'); for (const a of avisos) log('  - ' + a); }
if (avisos.some(a => a.includes('sin tildes'))) log('  -> Para retraducirlos de verdad: pipeline_todos.cmd --retraducir (usa la API)');
