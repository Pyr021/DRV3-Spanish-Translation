// Pruebas de la garantía de reajustar_saltos.mjs (mismoTexto).  node test_reajuste.mjs
import { mismoTexto } from './reajustar_saltos.mjs';
const casos = [
  // [antes, después, ¿válido?]
  ['Pero una chica -la única superviviente- arriesgo\nsu vida.', 'Pero una chica -la única superviviente-\narriesgo su vida.', true],
  ['PUEDES-GANAR-UN-MONTÓN-DE-MONOCOINS-Y-\nCAMBIARLOS-POR-PREMIOS', 'PUEDES-GANAR-UN-MONTÓN-\nDE-MONOCOINS-Y-CAMBIARLOS-\nPOR-PREMIOS', true],
  ['Es tan tosco... Me pregunto si\nes solo eso.', 'Es tan tosco...\nMe pregunto si es solo eso.', true],
  ['Hola mundo', 'Holamundo', false],          // palabras pegadas
  ['Hola mundo', 'Hola mudo', false],          // letra perdida
  ['Hola mundo', 'Ho la mundo', false],        // corte nuevo dentro de una palabra
  ['¿Qué? ¡Sí!', '¿Qué?\n¡Sí!', true],
  // guion de inciso al final de línea: NO es una cadena, no se puede pegar
  ['la única superviviente-\narriesgo su vida', 'la única superviviente-arriesgo su vida', false],
  ['la única superviviente-\narriesgo su vida', 'la única superviviente- arriesgo su vida', true],
];
let ok = 0;
for (const [a, b, esperado] of casos) {
  const r = mismoTexto(a, b);
  ok += r === esperado;
  console.log(`${r === esperado ? 'OK ' : 'MAL'} ${JSON.stringify(a)} -> ${JSON.stringify(b)} : ${r}`);
}
console.log(`${ok}/${casos.length} correctos`);
process.exitCode = ok === casos.length ? 0 : 1;
