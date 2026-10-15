// revisar_ia.mjs — segunda pasada OPCIONAL de corrección con DeepSeek (ortografía, gramática,
// concordancia y género). Por defecto solo envía los bloques en los que el verificador ve algo
// raro (barato); con --todos revisa todo.
//
// Uso:
//   node revisar_ia.mjs <dir_ingles> <dir_trad> <dir_salida> <glosario.txt> [--todos] [--simular]
//
// Cada corrección se valida: mismos bloques, mismas etiquetas, longitud entre el 60 % y el 150 %
// de la original y con tildes. Si no pasa, se conserva el texto anterior.
// Informe de cambios: <dir_salida>/_informe_revision.txt (antes / después de cada bloque).

import fs from 'fs';
import path from 'path';
import { leer, escribir, listarTxt, parseBloques, escribirBloques, etiquetasOk, llamarDeepSeek, opciones } from './comun.mjs';
import { analizar } from './ortografia.mjs';

const { pos, op } = opciones(process.argv, new Set(['--personajes']));
const [enDir, tradDir, outDir, glosarioPath] = pos;
if (!enDir || !tradDir || !outDir || !glosarioPath) {
  console.error('Uso: node revisar_ia.mjs <dir_ingles> <dir_trad> <dir_salida> <glosario.txt> [--todos] [--simular]');
  process.exit(1);
}
const personajesPath = op['--personajes'] || path.join(path.dirname(path.resolve(glosarioPath)), 'personajes.txt');
const personajes = fs.existsSync(personajesPath) ? leer(personajesPath) : '';

const SYSTEM = `Eres corrector profesional de una traducción al español de España de DANGANRONPA V3.
Recibes bloques con el original inglés (EN) y la traducción (ES). Devuelve SOLO la versión
corregida de cada bloque, con el formato "##### NNNN" seguido del texto en español.

Corrige ÚNICAMENTE:
- ortografía y tildes (incluidas las diacríticas: él/el, tú/tu, mí/mi, sí/si, sé/se, más/mas, aún/aun,
  qué/que, cómo/como, dónde/donde, cuándo/cuando, quién/quien, por qué/porque/porqué),
- signos de apertura ¿ ¡ (toda pregunta y exclamación los lleva, donde empieza la pregunta),
- concordancia de género y número (artículo, sustantivo, adjetivo, participio),
- concordancia sujeto-verbo y tiempos verbales,
- el género de los personajes según esta lista:
${personajes}
- errores de traducción evidentes (sentido contrario al inglés).

NO cambies el estilo, el registro ni la longitud; no reescribas frases correctas.
Conserva EXACTAMENTE las etiquetas <CLT=...>, <PAD=...>, <DIG=...>, <RUBY=...> y los saltos de línea.
Si un bloque está bien, devuélvelo idéntico.`;

const glosario = leer(glosarioPath);
const lote = [];
for (const f of listarTxt(tradDir)) {
  const rel = path.relative(tradDir, f);
  const B = parseBloques(leer(f));
  const enPath = path.join(enDir, rel);
  const A = fs.existsSync(enPath) ? parseBloques(leer(enPath)) : new Map();
  let prev = null;
  for (const [id, t] of B) {
    const sospechoso = analizar(t, { anterior: prev }).some(a => a.gravedad !== 'dudoso' || a.tipo === 'inglés');
    if (t.trim() && (op['--todos'] || sospechoso)) lote.push({ rel, id, en: A.get(id) ?? '', es: t });
    prev = t;
  }
}
console.log(`Bloques a revisar: ${lote.length}${op['--todos'] ? ' (todos)' : ' (solo los que tienen avisos)'}`);
if (op['--simular']) { console.log('SIMULACIÓN: no se llama a la API.'); process.exit(0); }

const cambios = new Map(); // rel -> Map(id -> nuevo)
const informe = [];
let stats = { llamadas: 0, cambiados: 0, rechazados: 0 };
for (let k = 0; k < lote.length; k += 30) {
  const trozo = lote.slice(k, k + 30);
  const user = `GLOSARIO (obligatorio):\n${glosario}\n\nBLOQUES:\n\n` + trozo.map((b, n) =>
    `##### ${String(n).padStart(4, '0')}\nEN: ${b.en.replace(/\n/g, ' / ')}\nES:\n${b.es}`).join('\n\n');
  process.stdout.write(`  trozo ${k / 30 + 1}/${Math.ceil(lote.length / 30)}... `);
  const r = await llamarDeepSeek([{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], { temperatura: 0.1 });
  stats.llamadas++;
  const sal = parseBloques(r.contenido.replace(/^ES:\s*\n?/gm, ''));
  let n2 = 0;
  trozo.forEach((b, n) => {
    const nuevo = sal.get(n);
    if (nuevo == null || nuevo === b.es) return;
    const ratio = nuevo.length / Math.max(1, b.es.length);
    if (!etiquetasOk(b.es, nuevo) || ratio < 0.6 || ratio > 1.5) { stats.rechazados++; return; }
    if (!cambios.has(b.rel)) cambios.set(b.rel, new Map());
    cambios.get(b.rel).set(b.id, nuevo);
    informe.push(`${b.rel} #${b.id}\n  ANTES:   ${JSON.stringify(b.es)}\n  DESPUÉS: ${JSON.stringify(nuevo)}`);
    stats.cambiados++; n2++;
  });
  console.log(`${n2} corregidos`);
}

for (const f of listarTxt(tradDir)) {
  const rel = path.relative(tradDir, f);
  const B = parseBloques(leer(f));
  const c = cambios.get(rel);
  escribir(path.join(outDir, rel), escribirBloques([...B].map(([id, t]) => [id, c?.get(id) ?? t])));
}
escribir(path.join(outDir, '_informe_revision.txt'), informe.join('\n\n') + '\n');
console.log(`\nLlamadas: ${stats.llamadas} | bloques corregidos: ${stats.cambiados} | rechazados por validación: ${stats.rechazados}`);
console.log(`Informe: ${path.join(outDir, '_informe_revision.txt')}`);
