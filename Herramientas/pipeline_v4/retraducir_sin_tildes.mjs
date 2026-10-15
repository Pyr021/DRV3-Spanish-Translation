// retraducir_sin_tildes.mjs — detecta los archivos que pasaron por limpiar_acentos.mjs y los
// retraduce DESDE EL INGLÉS con traductor_v4.mjs (prompt reforzado). No toca la carpeta de entrada.
//
// Uso:
//   node retraducir_sin_tildes.mjs <dir_ingles> <dir_trad_actual> <dir_salida> <glosario.txt> [--simular] [--solo-listar]
//
// 1. Busca en <dir_trad_actual> los archivos sin ninguna tilde (o con muchas palabras que la
//    exigen y casi ninguna tilde) y escribe la lista en <dir_salida>/_sin_tildes.txt
// 2. Copia TODOS los archivos de <dir_trad_actual> a <dir_salida>
// 3. Retraduce solo los de la lista, sobrescribiéndolos en <dir_salida>

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { leer, escribir, listarTxt, parseBloques, pareceLimpiado, opciones } from './comun.mjs';
import { analizar } from './ortografia.mjs';

const { pos, op } = opciones(process.argv, new Set());
const [enDir, tradDir, outDir, glosario] = pos;
if (!enDir || !tradDir || !outDir || !glosario) {
  console.error('Uso: node retraducir_sin_tildes.mjs <dir_ingles> <dir_trad_actual> <dir_salida> <glosario.txt> [--simular] [--solo-listar]');
  process.exit(1);
}
if (path.resolve(outDir) === path.resolve(tradDir)) { console.error('La salida no puede ser la misma carpeta que la traducción actual.'); process.exit(1); }

const lista = [];
for (const f of listarTxt(tradDir)) {
  const txt = leer(f);
  let err = 0;
  for (const t of parseBloques(txt).values()) err += analizar(t).filter(a => a.gravedad === 'seguro' && a.tipo === 'tilde').length;
  if (pareceLimpiado(txt, err)) lista.push(path.relative(tradDir, f));
}
escribir(path.join(outDir, '_sin_tildes.txt'), lista.join('\n') + (lista.length ? '\n' : ''));
console.log(`Archivos sin tildes: ${lista.length}  (lista en ${path.join(outDir, '_sin_tildes.txt')})`);
if (op['--solo-listar']) process.exit(0);

for (const f of listarTxt(tradDir)) {
  const rel = path.relative(tradDir, f);
  fs.mkdirSync(path.dirname(path.join(outDir, rel)), { recursive: true });
  fs.copyFileSync(f, path.join(outDir, rel));
}
if (!lista.length) { console.log(`Nada que retraducir; copia sin cambios en ${outDir}.`); process.exit(0); }
console.log(`Copiada la traducción actual a ${outDir}. Retraduciendo ${lista.length} archivos desde el inglés...\n`);

const aqui = path.dirname(fileURLToPath(import.meta.url));
const args = [path.join(aqui, 'traductor_v4.mjs'), enDir, outDir, glosario, '--lista', path.join(outDir, '_sin_tildes.txt'), '--forzar'];
if (op['--simular']) args.push('--simular');
execFileSync(process.execPath, args, { stdio: 'inherit' });
