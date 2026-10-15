// generar_calibracion.mjs — textos de prueba para medir la caja de dialogo EN EL JUEGO.
//
// Sustituye las primeras entradas con texto de cada archivo por:
//   * 4 lineas numeradas  -> cuantas lineas muestra la caja
//   * reglas de N px      -> la ultima cuya "|" final se ve entera = ancho maximo
// Las reglas se miden con las metricas reales de v3_font00.
//
// Uso: node generar_calibracion.mjs <dir_txt_original> <dir_salida> [--archivos N]

import fs from 'fs';
import path from 'path';
import { anchoPx } from './reajustar_saltos.mjs';

const args = process.argv.slice(2);
const [src, dst] = args.filter(a => !a.startsWith('--') && !/^\d+$/.test(a));
const ia = args.indexOf('--archivos');
const N = ia >= 0 ? parseInt(args[ia + 1], 10) : Infinity;
if (!src || !dst) { console.error('Uso: node generar_calibracion.mjs <dir_txt> <dir_salida> [--archivos N]'); process.exit(1); }

function regla(px) {
  let s = `${px}px `;
  while (anchoPx(s + '-|') <= px) s += '-';
  return s + '|';
}
const PRUEBAS = [
  'L1 Linea uno de la prueba\nL2 Linea dos de la prueba\nL3 Linea tres de la prueba\nL4 Linea cuatro de la prueba',
  ...[1200, 1250, 1300, 1350, 1400, 1450, 1500, 1600, 1700].map(regla),
  'Prueba fuente: ¿Qué? ¡Sí! Ñandú, pingüino\n«Último» 1ª 2º ÁÉÍÓÚ áéíóú',
];

const parse = (t) => {
  const ps = t.replace(/\r\n/g, '\n').split(/^#####[ \t]*(\d+)[ \t]*\n?/m);
  const m = new Map();
  for (let i = 1; i + 1 < ps.length; i += 2) {
    let s = ps[i + 1] ?? '';
    if (s.endsWith('\n\n')) s = s.slice(0, -2); else if (s.endsWith('\n')) s = s.slice(0, -1);
    m.set(parseInt(ps[i], 10), s);
  }
  return m;
};

fs.mkdirSync(dst, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(src).filter(f => f.endsWith('.txt')).sort()) {
  if (n >= N) break;
  const m = parse(fs.readFileSync(path.join(src, f), 'utf-8'));
  let k = 0, out = '';
  for (const [i, s] of m) {
    // Se respeta la etiqueta inicial (<CLT=cltMIND> etc.) para no cambiar el tipo de caja.
    const pref = (s.match(/^(<[^>]+>)*/) || [''])[0];
    const v = s.trim() && k < PRUEBAS.length ? pref + PRUEBAS[k++] : s;
    out += `##### ${String(i).padStart(4, '0')}\n${v}\n\n`;
  }
  fs.writeFileSync(path.join(dst, f), out, 'utf-8');
  n++;
}
console.log(`${n} archivos de calibracion en ${dst}`);
for (const p of PRUEBAS) console.log(`  ${anchoPx(p.split('\n')[0])}px  ${JSON.stringify(p)}`);
