// traductor_v4.mjs — traductor DRV3 inglés -> español de España, con control de ortografía.
//
// Sobre traductor_stx_v2.mjs (troceado, verificación de bloques y etiquetas, no escribe a medias):
//   1. Prompt reforzado (prompt_es.mjs): ortografía, tildes diacríticas, ¿¡, concordancia, género.
//   2. Tras cada trozo pasa el verificador (ortografia.mjs). Si hay errores SEGUROS, pide UNA
//      corrección al modelo con la lista exacta de errores y se queda con la mejor versión.
//   3. Autocorrección determinista final de lo seguro (tildes obligatorias, ¿¡). Desactivable.
//   4. Rechaza salidas "limpiadas" (sin ninguna tilde) como si fueran un fallo.
//   5. La clave SOLO se lee de DEEPSEEK_API_KEY (nada de claves en el código).
//   6. --simular: no llama a la API; enseña el plan de trozos y el tamaño del prompt.
//
// Uso:
//   node traductor_v4.mjs <dir_entrada_ingles> <dir_salida> <glosario.txt> [opciones]
// Opciones:
//   --personajes F       personajes.txt (def. junto al glosario)
//   --max-entradas N     entradas por llamada (def. 40)
//   --max-chars N        caracteres por llamada (def. 12000)
//   --solo a.txt,b.txt   solo esos archivos      --lista F   archivos listados en F (uno por línea)
//   --forzar             rehacer aunque ya exista
//   --sin-autocorregir   no aplicar la autocorrección determinista
//   --modelo NOMBRE      def. deepseek-chat      --pausa MS  pausa entre archivos (def. 500)
//   --simular            no gasta nada: solo enseña lo que haría

import fs from 'fs';
import path from 'path';
import { parseBloques, escribirBloques, leer, escribir, listarTxt, etiquetasOk, TAG_RE, pareceLimpiado, llamarDeepSeek, opciones } from './comun.mjs';
import { promptSistema, promptCorreccion } from './prompt_es.mjs';
import { analizar, corregir } from './ortografia.mjs';

const CON_VALOR = new Set(['--personajes', '--max-entradas', '--max-chars', '--solo', '--lista', '--modelo', '--pausa']);
const { pos, op } = opciones(process.argv, CON_VALOR);
const [inputDir, outputDir, glosarioPath] = pos;
if (!inputDir || !outputDir || !glosarioPath) {
  console.error('Uso: node traductor_v4.mjs <dir_entrada_ingles> <dir_salida> <glosario.txt> [--solo a.txt] [--lista f] [--forzar] [--simular]');
  process.exit(1);
}
const MAX_ENTRADAS = parseInt(op['--max-entradas'] || '40', 10);
const MAX_CHARS = parseInt(op['--max-chars'] || '12000', 10);
const MODELO = op['--modelo'] || 'deepseek-chat';
const PAUSA = parseInt(op['--pausa'] || '500', 10);
const FORZAR = !!op['--forzar'];
const SIMULAR = !!op['--simular'];
const AUTOCORREGIR = !op['--sin-autocorregir'];
let SOLO = op['--solo'] ? op['--solo'].split(',').map(s => s.trim()).filter(Boolean) : null;
if (op['--lista']) SOLO = leer(op['--lista']).split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(s => path.basename(s));

const glosario = leer(glosarioPath);
const personajesPath = op['--personajes'] || path.join(path.dirname(path.resolve(glosarioPath)), 'personajes.txt');
const personajes = fs.existsSync(personajesPath) ? leer(personajesPath) : '';
if (!personajes) console.warn(`AVISO: no se encontró ${personajesPath}; sin control de género.`);
const SYSTEM = promptSistema(glosario, personajes);

const bloquesATexto = (entradas) => entradas.map(([i, t]) => `##### ${String(i).padStart(4, '0')}\n${t}`).join('\n\n');
const stats = { pt: 0, ct: 0, llamadas: 0, correcciones: 0 };

// errores seguros de un conjunto de bloques traducidos (para el reintento)
function erroresSeguros(salida, entradas) {
  const err = [];
  let prev = null;
  for (const [i] of entradas) {
    const t = salida.get(i);
    if (t == null) continue;
    for (const a of analizar(t, { anterior: prev })) {
      if (a.gravedad === 'seguro') err.push({ bloque: String(i).padStart(4, '0'), mensaje: a.palabra ? `${a.mensaje}: "${a.palabra}" -> "${a.sugerencia}"` : a.mensaje });
    }
    prev = t;
  }
  return err;
}

function validar(salida, entradas) {
  const perdidas = entradas.filter(e => !salida.has(e[0]));
  const tagsMal = entradas.filter(e => salida.has(e[0]) && !etiquetasOk(e[1], salida.get(e[0])));
  const texto = entradas.map(([i]) => salida.get(i) ?? '').join('\n');
  // "sin ninguna tilde" solo cuenta como fallo con bastante texto (200+ letras): una frase
  // corta sin tildes es normal en español.
  const letras = (texto.replace(TAG_RE, '').match(/\p{L}/gu) || []).length;
  const limpiado = letras >= 200 && !/[áéíóúÁÉÍÓÚñÑ]/.test(texto);
  return { perdidas, tagsMal, limpiado, ok: !perdidas.length && !tagsMal.length && !limpiado };
}

async function traducirTrozo(entradas, profundidad = 0) {
  const user = `Traduce estos bloques. Devuelve exactamente ${entradas.length} bloques "##### NNNN".\n\n${bloquesATexto(entradas)}`;
  const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }];
  let r = await llamarDeepSeek(messages, { modelo: MODELO });
  stats.pt += r.pt; stats.ct += r.ct; stats.llamadas++;
  let salida = parseBloques(r.contenido);
  let v = validar(salida, entradas);

  if (v.ok) {
    // control de ortografía: un único reintento dirigido
    const err = erroresSeguros(salida, entradas);
    if (err.length) {
      const r2 = await llamarDeepSeek([...messages, { role: 'assistant', content: r.contenido }, { role: 'user', content: promptCorreccion(err.slice(0, 60)) }], { modelo: MODELO });
      stats.pt += r2.pt; stats.ct += r2.ct; stats.llamadas++; stats.correcciones++;
      const s2 = parseBloques(r2.contenido);
      if (validar(s2, entradas).ok && erroresSeguros(s2, entradas).length < err.length) salida = s2;
    }
    return new Map(entradas.map(([i]) => [i, salida.get(i)]));
  }

  if (v.perdidas.length) console.log(`      aviso: faltan ${v.perdidas.length}/${entradas.length} entradas (finish=${r.finish})`);
  if (v.tagsMal.length) console.log(`      aviso: ${v.tagsMal.length}/${entradas.length} entradas con etiquetas alteradas`);
  if (v.limpiado) console.log('      aviso: la salida no tiene NINGUNA tilde -> se repite');
  if (entradas.length === 1) {
    if (!v.perdidas.length && v.tagsMal.length) {
      const i = entradas[0][0];
      const reparado = alinearEtiquetas(entradas[0][1], salida.get(i));
      if (reparado) { console.log(`      entrada ${i}: etiquetas realineadas con el original`); return new Map([[i, reparado]]); }
    }
    if (profundidad < 8) return traducirTrozo(entradas, profundidad + 1);
    throw new Error(`no se pudo traducir la entrada ${entradas[0][0]}`);
  }
  if (profundidad > 6) throw new Error('demasiados niveles de troceado');
  const mitad = Math.ceil(entradas.length / 2);
  const a = await traducirTrozo(entradas.slice(0, mitad), profundidad + 1);
  const b = await traducirTrozo(entradas.slice(mitad), profundidad + 1);
  return new Map([...a, ...b]);
}

// Conserva el texto traducido y le injerta las etiquetas del original en posiciones relativas.
function alinearEtiquetas(orig, trad) {
  const limpio = trad.replace(TAG_RE, '');
  const longOrig = orig.replace(TAG_RE, '').length || 1;
  let out = '', cursor = 0, pos = 0;
  for (const m of orig.matchAll(TAG_RE)) {
    const antes = orig.slice(0, m.index).replace(TAG_RE, '').length;
    const destino = Math.min(limpio.length, Math.round((antes / longOrig) * limpio.length));
    if (destino > cursor) { out += limpio.slice(cursor, destino); cursor = destino; }
    out += m[0];
    pos = m.index + m[0].length;
  }
  return out + limpio.slice(cursor);
}

async function procesarArchivo(archivo) {
  const rel = path.relative(inputDir, archivo);
  const salidaPath = path.join(outputDir, rel);
  const mapaOrig = parseBloques(leer(archivo));
  const entradas = [...mapaOrig.entries()];
  if (fs.existsSync(salidaPath) && !FORZAR) {
    const ya = parseBloques(leer(salidaPath));
    if (entradas.every(([i, t]) => ya.has(i) || !t.trim()) && !pareceLimpiado(leer(salidaPath))) {
      console.log(`[SKIP] ${rel} (ya correcto)`);
      return 'saltado';
    }
  }
  const utiles = entradas.filter(([, t]) => t.trim() !== '');
  const trozos = [];
  let actual = [], chars = 0;
  for (const e of utiles) {
    const len = e[1].length + 12;
    if (actual.length && (actual.length >= MAX_ENTRADAS || chars + len > MAX_CHARS)) { trozos.push(actual); actual = []; chars = 0; }
    actual.push(e); chars += len;
  }
  if (actual.length) trozos.push(actual);
  console.log(`[TRADUCIENDO] ${rel} (${entradas.length} entradas, ${trozos.length} trozos)`);
  if (SIMULAR) return 'ok';
  try {
    const resultado = new Map();
    for (let k = 0; k < trozos.length; k++) {
      process.stdout.write(`   trozo ${k + 1}/${trozos.length} (${trozos[k].length} entradas)... `);
      const m = await traducirTrozo(trozos[k]);
      for (const [a, b] of m) resultado.set(a, b);
      console.log(`${m.size} ok`);
    }
    const faltan = utiles.filter(([i]) => !resultado.has(i));
    if (faltan.length) throw new Error(`quedan ${faltan.length} entradas sin traducir; NO se escribe el archivo`);
    const final = [];
    let prev = null, autocorr = 0;
    for (const [i, t] of entradas) {
      let v = resultado.has(i) ? resultado.get(i) : t;
      if (AUTOCORREGIR && resultado.has(i)) {
        const c = corregir(v, { anterior: prev });
        if (c.cambios.length) { autocorr += c.cambios.length; v = c.texto; }
      }
      final.push([i, v]);
      prev = v;
    }
    escribir(salidaPath, escribirBloques(final));
    console.log(`   -> GUARDADO (${resultado.size}/${entradas.length})${autocorr ? `, ${autocorr} autocorrecciones` : ''}`);
    return 'ok';
  } catch (e) {
    console.error(`   -> ERROR: ${e.message}`);
    return 'fallo';
  }
}

const todos = listarTxt(inputDir);
const archivos = SOLO ? todos.filter(f => SOLO.includes(path.basename(f))) : todos;
console.log(`Modelo: ${MODELO}${SIMULAR ? '   (SIMULACIÓN: no se llama a la API)' : ''}`);
console.log(`Archivos: ${archivos.length}${SOLO ? ` (de ${todos.length})` : ''} | troceado: ${MAX_ENTRADAS} entradas / ${MAX_CHARS} caracteres`);
console.log(`Prompt de sistema: ${SYSTEM.length} caracteres (~${Math.round(SYSTEM.length / 3.5)} tokens, se cachea entre llamadas)\n`);
let ok = 0, saltados = 0, fallos = 0;
for (const f of archivos) {
  const r = await procesarArchivo(f);
  if (r === 'ok') ok++; else if (r === 'saltado') saltados++; else fallos++;
  if (PAUSA > 0 && !SIMULAR) await new Promise(res => setTimeout(res, PAUSA));
}
console.log(`\nListo. ${ok} OK, ${saltados} saltados, ${fallos} fallos.`);
if (!SIMULAR) console.log(`Llamadas: ${stats.llamadas} (correcciones: ${stats.correcciones}) | tokens prompt=${stats.pt} completion=${stats.ct}`);
if (fallos) { console.log('ATENCIÓN: hubo fallos; esos archivos NO se han escrito.'); process.exitCode = 1; }
