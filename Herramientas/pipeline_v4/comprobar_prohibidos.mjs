// comprobar_prohibidos.mjs — impide que limpiar_acentos.mjs / limpiar_mod.mjs vuelvan a usarse.
//
// Uso: node comprobar_prohibidos.mjs <carpeta_scripts> [--bloquear]
//   sin --bloquear: avisa y sale con código 1 si encuentra los scripts prohibidos
//   con --bloquear: los renombra a *.mjs.PROHIBIDO (ya no se pueden ejecutar por error)
import fs from 'fs';
import path from 'path';

const dir = process.argv[2] || '.';
const bloquear = process.argv.includes('--bloquear');
const PROHIBIDOS = ['limpiar_acentos.mjs', 'limpiar_mod.mjs'];
let encontrados = 0;
for (const n of PROHIBIDOS) {
  const p = path.join(dir, n);
  if (!fs.existsSync(p)) continue;
  encontrados++;
  if (bloquear) {
    fs.renameSync(p, p + '.PROHIBIDO');
    console.log(`Bloqueado: ${n} -> ${n}.PROHIBIDO`);
  } else {
    console.log(`PROHIBIDO: ${p} existe. Borra las tildes, la ñ y los ¿¡. Ejecuta con --bloquear para desactivarlo.`);
  }
}
if (!encontrados) console.log('OK: no hay scripts prohibidos en el pipeline.');
if (encontrados && !bloquear) process.exitCode = 1;
