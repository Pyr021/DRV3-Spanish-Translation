// traductor_stx_v2.mjs — Traductor blindado para Danganronpa V3 (espanol de Espana)
//
// MEJORAS FRENTE A traductor_stx.mjs (el que truncaba archivos):
//   1. TROCEA por numero de entradas y por caracteres -> nunca supera el limite
//      de tokens de salida (medido: ~70 tokens/entrada, caben ~116 por llamada).
//   2. VERIFICA cada trozo: si no vuelven todas las entradas, parte el trozo en
//      dos y reintenta; nunca escribe un resultado incompleto.
//   3. ABORTA en vez de guardar basura: si un archivo no se puede completar,
//      NO se escribe.
//   4. Prompt en system (cacheable) + user -> mucho mas barato por token.
//   5. Conserva glosario, personajes.txt, reglas de genero y de tildes.
//   6. Reanudable y selectivo: --solo a.txt,b.txt y --forzar.
//
// Uso:
//   node traductor_stx_v2.mjs <dir_entrada> <dir_salida> <glosario> [opciones]
//
// Opciones:
//   --max-entradas N    Entradas por llamada (def. 50)
//   --max-chars N       Caracteres por llamada (def. 14000)
//   --solo a.txt,b.txt  Traducir solo esos archivos
//   --forzar            Rehacer aunque ya exista
//   --modelo NOMBRE     Modelo (def. deepseek-chat)

import fs from 'fs';
import path from 'path';

const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const API_URL = 'https://api.deepseek.com/chat/completions';

const args = process.argv.slice(2);
const posicionales = args.filter(a => !a.startsWith('--'));
const opcion = (n, def) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const bandera = (n) => args.includes(n);

const inputDir = posicionales[0];
const outputDir = posicionales[1];
const glosarioPath = posicionales[2];

if (!inputDir || !outputDir || !glosarioPath) {
  console.error('Uso: node traductor_stx_v2.mjs <dir_entrada> <dir_salida> <glosario> [--max-entradas N] [--solo a.txt,b.txt] [--forzar]');
  process.exit(1);
}

const MAX_ENTRADAS = parseInt(opcion('--max-entradas', '50'), 10);
const MAX_CHARS = parseInt(opcion('--max-chars', '14000'), 10);
const CONCURRENCIA = parseInt(opcion('--concurrencia', '1'), 10);
const SLEEP = parseInt(opcion('--pausa', '1000'), 10);
const MODELO = opcion('--modelo', 'deepseek-chat');
const FORZAR = bandera('--forzar');
const soloArg = opcion('--solo', '');
const SOLO = soloArg ? soloArg.split(',').map(s => s.trim()).filter(Boolean) : null;

const glosario = fs.readFileSync(glosarioPath, 'utf-8');
const personajesPath = 'C:\\Users\\david\\traductor_v3\\personajes.txt';
const personajes = fs.existsSync(personajesPath) ? fs.readFileSync(personajesPath, 'utf-8') : '';
if (!personajes) console.warn('AVISO: no se encontro personajes.txt; sin control de genero.');

const SYSTEM = `Eres un traductor profesional de videojuegos japoneses al espanol de Espana.
Traduces DANGANRONPA V3: KILLING HARMONY del ingles al espanol.

TERMINOLOGIA OBLIGATORIA:
${glosario}

PERSONAJES Y GENERO:
${personajes}

REGLAS INVIOLABLES:
1. Los marcadores "##### NNNN" deben aparecer EXACTAMENTE igual, al inicio de su bloque.
2. Devuelve EXACTAMENTE el mismo numero de bloques "##### NNNN" que recibes. Ni uno mas ni uno menos. Es el error mas grave posible.
3. NUNCA modifiques las etiquetas <CLT=...>, <PAD=...>, <DIG=...> ni <RUBY=...>: deben quedar identicas.
4. Conserva los saltos de linea internos de cada bloque si el original los tiene.
5. Traduce al espanol de Espana manteniendo el tono (misterio, humor, drama).
6. NO traduzcas nombres propios de la saga (Monokuma, Monokubs, Exisals, Atua, Neo-Aikido, personajes).
7. Si un texto ya esta en espanol, es un nombre propio o son caracteres japoneses, dejalo tal cual.
8. NO incluyas introducciones, despedidas ni explicaciones. Devuelve SOLO los bloques traducidos.

CARACTERES ESPECIALES (MUY IMPORTANTE):
- USA tildes correctamente en vocales y sus mayusculas.
- USA la enie cuando corresponda.
- USA los signos de apertura y cierre correctos.
- USA la dieresis cuando corresponda.
- NO uses comillas tipograficas; usa comillas rectas.
- NO uses guiones largos; usa guiones normales.

GENERO GRAMATICAL:
- Cuando un adjetivo, participio o pronombre se refiera a un personaje, usa SIEMPRE el genero correcto segun la lista de personajes.
- Ejemplo: a Kaede se le dice "eres tonta"; a Shuichi, "eres tonto".`;

// Tolerante: reconoce tambien bloques VACIOS al final (el modelo devuelve
// "##### 0210\n" y a veces sin salto final). Si no, se cuentan como perdidos.
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

function bloquesATexto(entradas) {
  return entradas.map(([i, t]) => `##### ${String(i).padStart(4, '0')}\n${t}`).join('\n\n');
}

async function llamarAPI(entradas, maxTokens) {
  const cuerpo = {
    model: MODELO,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Traduce estos bloques. Devuelve exactamente ${entradas.length} bloques "##### NNNN".\n\n${bloquesATexto(entradas)}` }
    ],
    temperature: 0.3,
    max_tokens: maxTokens
  };
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + API_KEY },
    body: JSON.stringify(cuerpo)
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${txt.slice(0, 300)}`);
  const j = JSON.parse(txt);
  return {
    contenido: j.choices[0].message.content,
    finish: j.choices[0].finish_reason,
    pt: j.usage?.prompt_tokens ?? 0,
    ct: j.usage?.completion_tokens ?? 0
  };
}

// Etiquetas de formato: nunca pueden cambiar de recuento.
const TAG_RE = /<(?:CLT|PAD|DIG|RUBY)=[^>]*>/g;
function contarTags(s) {
  const c = new Map();
  for (const m of s.matchAll(TAG_RE)) c.set(m[0], (c.get(m[0]) || 0) + 1);
  return c;
}
function etiquetasOk(original, traducido) {
  const a = contarTags(original), b = contarTags(traducido);
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    if ((a.get(k) || 0) !== (b.get(k) || 0)) return false;
  }
  return true;
}

// Devuelve un Map con SOLO las entradas traducidas con exito.
const stats = { pt: 0, ct: 0, llamadas: 0 };

async function traducirTrozo(entradas, profundidad = 0) {
  const r = await llamarAPI(entradas, 8192);
  stats.pt += r.pt; stats.ct += r.ct; stats.llamadas++;

  const salida = parseBloques(r.contenido);
  const perdidas = entradas.filter(e => !salida.has(e[0]));
  // Ademas de estar todas, las etiquetas de formato deben conservar su recuento.
  const tagsMal = entradas.filter(e => salida.has(e[0]) && !etiquetasOk(e[1], salida.get(e[0])));

  if (perdidas.length === 0 && tagsMal.length === 0) {
    const m = new Map();
    for (const [i] of entradas) m.set(i, salida.get(i));
    return m;
  }

  if (perdidas.length) console.log(`      aviso: faltan ${perdidas.length}/${entradas.length} entradas (finish=${r.finish})`);
  if (tagsMal.length) console.log(`      aviso: ${tagsMal.length}/${entradas.length} entradas con etiquetas alteradas -> reintentando`);

  if (entradas.length === 1) {
    const i = entradas[0][0];
    // Ultimo recurso para etiquetas: conservar la traduccion pero devolver
    // EXACTAMENTE las etiquetas del original en su sitio funcional.
    if (!perdidas.length && tagsMal.length) {
      const orig = entradas[0][1];
      const trad = salida.get(i);
      const reparado = alinearEtiquetas(orig, trad);
      if (reparado) {
        console.log(`      entrada ${i}: etiquetas realineadas con el original`);
        return new Map([[i, reparado]]);
      }
    }
    throw new Error(`no se pudo traducir la entrada ${i} (entradas faltantes o etiquetas alteradas)`);
  }
  if (profundidad > 6) {
    throw new Error(`demasiados niveles de troceado; faltan ${perdidas.length} entradas, ${tagsMal.length} con etiquetas mal`);
  }
  const mitad = Math.ceil(entradas.length / 2);
  const a = await traducirTrozo(entradas.slice(0, mitad), profundidad + 1);
  const b = await traducirTrozo(entradas.slice(mitad), profundidad + 1);
  const m = new Map();
  for (const [i] of entradas) {
    const v = a.has(i) ? a.get(i) : (b.has(i) ? b.get(i) : undefined);
    if (v !== undefined) m.set(i, v);
  }
  return m;
}

// Alinea las etiquetas del traducido con las del original SIN tocar palabras.
// Se conserva el texto traduccion despojado de etiquetas y se le injerta la
// secuencia de etiquetas del original en las mismas posiciones relativas.
function alinearEtiquetas(orig, trad) {
  const secOrig = [...orig.matchAll(TAG_RE)].map(m => m[0]);
  const limpio = trad.replace(TAG_RE, '');
  if (!secOrig.length) return limpio;
  // Repartir las etiquetas del original segun su posicion relativa en el original
  const cortes = [];
  let pos = 0;
  for (const m of orig.matchAll(TAG_RE)) {
    cortes.push({ tag: m[0], antes: orig.slice(pos, m.index).replace(TAG_RE, '').length });
    pos = m.index + m[0].length;
  }
  const longitud = limpio.length;
  const longOrig = orig.replace(TAG_RE, '').length || 1;
  let out = '';
  let cursor = 0;
  for (const c of cortes) {
    const destino = Math.min(longitud, Math.round((c.antes / longOrig) * longitud));
    if (destino > cursor) { out += limpio.slice(cursor, destino); cursor = destino; }
    out += c.tag;
  }
  out += limpio.slice(cursor);
  return out;
}

// ---------- recorrido de archivos ----------
function walkTxt(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkTxt(f));
    else if (/\.txt$/i.test(e.name)) out.push(f);
  }
  return out;
}

// Traduce UN archivo. Devuelve 'ok' | 'saltado' | 'fallo'.
async function procesarArchivo(archivo) {
  const rel = path.relative(inputDir, archivo);
  const salidaPath = path.join(outputDir, rel);
  const mapaOrig = parseBloques(fs.readFileSync(archivo, 'utf-8'));
  const entradas = [...mapaOrig.entries()];

  if (fs.existsSync(salidaPath) && !FORZAR) {
    const ya = parseBloques(fs.readFileSync(salidaPath, 'utf-8'));
    const faltan = entradas.filter(([i, t]) => !ya.has(i) && t.trim() !== '');
    if (faltan.length === 0) {
      console.log(`[SKIP] ${rel} (ya correcto)`);
      return 'saltado';
    }
    console.log(`[REHACER] ${rel} (faltan ${faltan.length} entradas)`);
  }

  console.log(`[TRADUCIENDO] ${rel} (${entradas.length} entradas)`);
  try {
    // No enviar a la API las entradas vacias: no hay nada que traducir.
    const utiles = entradas.filter(([, t]) => t.trim() !== '');
    const vacias = entradas.length - utiles.length;

    const trozos = [];
    let actual = [], chars = 0;
    for (const e of utiles) {
      const len = e[1].length + 12;
      if (actual.length && (actual.length >= MAX_ENTRADAS || chars + len > MAX_CHARS)) {
        trozos.push(actual); actual = []; chars = 0;
      }
      actual.push(e); chars += len;
    }
    if (actual.length) trozos.push(actual);
    if (vacias) console.log(`   (${vacias} entradas vacias se conservan tal cual, no se envian)`);

    const resultado = new Map();
    for (let i = 0; i < trozos.length; i++) {
      process.stdout.write(`   trozo ${i + 1}/${trozos.length} (${trozos[i].length} entradas)... `);
      const m = await traducirTrozo(trozos[i]);
      for (const [k, v] of m) resultado.set(k, v);
      console.log(`${m.size} ok`);
    }

    const faltan = utiles.filter(([i]) => !resultado.has(i));
    if (faltan.length > 0) {
      throw new Error(`quedan ${faltan.length} entradas sin traducir; NO se escribe el archivo`);
    }

    let out = '';
    for (const [i, t] of entradas) {
      const v = resultado.has(i) ? resultado.get(i) : t;
      out += `##### ${String(i).padStart(4, '0')}\n${v}\n\n`;
    }
    fs.mkdirSync(path.dirname(salidaPath), { recursive: true });
    fs.writeFileSync(salidaPath, out, 'utf-8');
    console.log(`   -> GUARDADO (${resultado.size}/${entradas.length} entradas traducidas)`);
    return 'ok';
  } catch (e) {
    console.error(`   -> ERROR: ${e.message}`);
    return 'fallo';
  }
}

const todos = walkTxt(inputDir);
const archivos = SOLO ? todos.filter(f => SOLO.includes(path.basename(f))) : todos;

console.log(`Modelo             : ${MODELO}`);
console.log(`Archivos a traducir: ${archivos.length}${SOLO ? ` (de ${todos.length} en total)` : ''}`);
console.log(`Troceado           : max ${MAX_ENTRADAS} entradas / ${MAX_CHARS} caracteres por llamada`);
console.log(`Concurrencia       : ${CONCURRENCIA}`);
console.log('');

let ok = 0, saltados = 0, fallos = 0;

// Cola con concurrencia limitada: los archivos ya hechos se detectan y se
// saltan, asi que reanudar es barato.
const cola = [...archivos];
async function trabajador() {
  while (cola.length) {
    const f = cola.shift();
    const r = await procesarArchivo(f);
    if (r === 'ok') ok++; else if (r === 'saltado') saltados++; else fallos++;
    if (SLEEP > 0) await new Promise(res => setTimeout(res, SLEEP));
  }
}
await Promise.all(Array.from({ length: Math.max(1, CONCURRENCIA) }, trabajador));

console.log('');
console.log(`Listo. ${ok} OK, ${saltados} saltados, ${fallos} fallos.`);
console.log(`Llamadas a la API: ${stats.llamadas}  |  tokens prompt=${stats.pt} completion=${stats.ct}`);
if (fallos) console.log('ATENCION: hubo fallos; esos archivos NO se han escrito.');
