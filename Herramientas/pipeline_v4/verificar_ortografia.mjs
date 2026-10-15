// verificar_ortografia.mjs — revisa la ortografia de una carpeta de traducciones.
//
// Uso:
//   node verificar_ortografia.mjs <dir_traducido> [--original <dir_ingles>]
//        [--corregir <dir_salida>] [--probables] [--informe <archivo>] [--no-bloquear]
//
//   --original    compara con el ingles (detecta bloques sin traducir)
//   --corregir    escribe una copia corregida SOLO con los cambios "seguros"
//                 (+ los "probables" si se anade --probables). Nunca toca etiquetas.
//   --informe     ruta del informe (def. <dir_traducido>/_informe_ortografia.txt)
//   --no-bloquear termina con codigo 0 aunque haya errores seguros
//
// Sale con codigo 1 si quedan errores "seguros" (para que el pipeline se pare).

import path from 'path';
import fs from 'fs';
import { parseBloques, escribirBloques, leer, escribir, listarTxt, pareceLimpiado, opciones } from './comun.mjs';
import { analizar, corregir } from './ortografia.mjs';

const { pos, op } = opciones(process.argv, new Set(['--original', '--corregir', '--informe']));
const dir = pos[0];
if (!dir) {
  console.error('Uso: node verificar_ortografia.mjs <dir_traducido> [--original dir] [--corregir dir_salida] [--probables] [--informe f] [--no-bloquear]');
  process.exit(1);
}
const informePath = op['--informe'] || path.join(op['--corregir'] || dir, '_informe_ortografia.txt');

const total = { seguro: 0, probable: 0, dudoso: 0 };
const porTipo = {};
const lineas = [];
const limpiados = [];
let corregidos = 0, archivos = 0;

for (const f of listarTxt(dir)) {
  const rel = path.relative(dir, f);
  const txt = leer(f);
  archivos++;
  let erroresTilde = 0;
  const B = parseBloques(txt);
  const origPath = op['--original'] ? path.join(op['--original'], rel) : null;
  const A = origPath && fs.existsSync(origPath) ? parseBloques(leer(origPath)) : null;
  const salida = [];
  let prev = null;
  for (const [id, t] of B) {
    const avisos = analizar(t, { original: A?.get(id) ?? null, anterior: prev });
    for (const a of avisos) {
      if (a.gravedad === 'seguro' && a.tipo === 'tilde') erroresTilde++;
      total[a.gravedad]++;
      porTipo[`${a.gravedad} / ${a.tipo}`] = (porTipo[`${a.gravedad} / ${a.tipo}`] || 0) + 1;
      lineas.push(`${a.gravedad.toUpperCase().padEnd(8)} ${rel} #${id}  ${a.mensaje}${a.sugerencia != null && a.palabra ? `   "${a.palabra}" -> "${a.sugerencia}"` : ''}${a.contexto ? `\n         ${a.contexto}` : ''}`);
    }
    if (op['--corregir']) {
      const r = corregir(t, { probables: !!op['--probables'], anterior: prev });
      if (r.cambios.length) corregidos++;
      salida.push([id, r.texto]);
    }
    prev = t;
  }
  if (op['--corregir']) escribir(path.join(op['--corregir'], rel), escribirBloques(salida));
  if (pareceLimpiado(txt, erroresTilde)) limpiados.push(rel);
}
// lista de archivos a retraducir, para retraducir_sin_tildes.mjs
escribir(path.join(path.dirname(informePath), '_sin_tildes.txt'), limpiados.join('\n') + (limpiados.length ? '\n' : ''));

const orden = { SEGURO: 0, PROBABLE: 1, DUDOSO: 2 };
lineas.sort((a, b) => orden[a.split(' ')[0]] - orden[b.split(' ')[0]]);
const cab = [
  `INFORME DE ORTOGRAFÍA — ${new Date().toISOString().slice(0, 16)}`,
  `Archivos: ${archivos}   seguros: ${total.seguro}   probables: ${total.probable}   dudosos: ${total.dudoso}`,
  '',
  'Por tipo:',
  ...Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${String(v).padStart(6)}  ${k}`),
  '',
];
if (limpiados.length) {
  cab.push(`ARCHIVOS SIN NINGUNA TILDE (${limpiados.length}): pasaron por limpiar_acentos.mjs.`,
    'Hay que RETRADUCIRLOS (retraducir_sin_tildes.mjs); corregirlos palabra a palabra no basta.',
    ...limpiados.map(x => '  ' + x), '');
}
escribir(informePath, cab.join('\n') + '\n' + lineas.join('\n') + '\n');

console.log(`Archivos: ${archivos} | seguros: ${total.seguro} | probables: ${total.probable} | dudosos: ${total.dudoso} | sin tildes: ${limpiados.length}`);
if (op['--corregir']) console.log(`Corregidos (bloques con cambios): ${corregidos}  ->  ${op['--corregir']}`);
console.log(`Informe: ${informePath}`);
if (total.seguro > 0 && !op['--corregir'] && !op['--no-bloquear']) process.exitCode = 1;
