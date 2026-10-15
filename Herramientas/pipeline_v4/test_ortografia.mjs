// Pruebas del detector/corrector (sin API).  node test_ortografia.mjs
import { analizar, corregir, EXCLUIDAS } from './ortografia.mjs';
const casos = [
  ['Asi que debio ser el.', 'Así que debió ser él.'],
  ['Tambien hay una cancion en la habitacion.', 'También hay una canción en la habitación.'],
  ['¿Que estas haciendo aqui?', '¿Qué estás haciendo aquí?'],
  ['No se. Haber si lo encontramos despues.', 'No sé. A ver si lo encontramos después.'],
  ['Lo he echo yo. Te hecho de menos.', 'Lo he hecho yo. Te echo de menos.'],
  ['¿Porque lo hiciste? Porque tenia miedo.', '¿Por qué lo hiciste? Porque tenía miedo.'],
  ['Ay que darse prisa. ¡Hay, me duele!', 'Hay que darse prisa. ¡Ay, me duele!'],
  ['Esta bien, tu eres el culpable, ¿verdad?', 'Está bien, tú eres el culpable, ¿verdad?'],
  ['Kaito tubo que irse. Iva a llover.', 'Kaito tuvo que irse. Iba a llover.'],
  ['De donde se trajo el cuerpo?', '¿De dónde se trajo el cuerpo?'],
  ['<CLT=cltMIND>El laboratorio de Ryoma esta cerrado.', '<CLT=cltMIND>El laboratorio de Ryoma está cerrado.'],
  ['PUEDES-GANAR-UN-MONTON-DE-MONOCOINS-TAMBIEN.', 'PUEDES-GANAR-UN-MONTÓN-DE-MONOCOINS-TAMBIÉN.'],
  ['Esta habitación es la del crimen.', 'Esta habitación es la del crimen.'],
  ['Si lo hubiera sabido, no estaría aquí.', 'Si lo hubiera sabido, no estaría aquí.'],
  // --- condicionales
  ['<CLT=cltSYSTEM>¿Te gustaria irte?', '<CLT=cltSYSTEM>¿Te gustaría irte?'],
  ['Eso seria genial. Tendria que pensarlo.', 'Eso sería genial. Tendría que pensarlo.'],
  ['Deberiamos irnos. ¿Vendrias conmigo?', 'Deberíamos irnos. ¿Vendrías conmigo?'],
  ['Haria cualquier cosa. Lo diria otra vez.', 'Haría cualquier cosa. Lo diría otra vez.'],
  ['Podria ser. Daria lo que fuera. Iria yo.', 'Podría ser. Daría lo que fuera. Iría yo.'],
  ['Comeria algo. Sabria que hacer. Me quedaria.', 'Comería algo. Sabría que hacer. Me quedaría.'],
  ['Lo pondria aqui. Saldria corriendo. Lo traeria.', 'Lo pondría aquí. Saldría corriendo. Lo traería.'],
  ['No valdria la pena. No cabria duda.', 'No valdría la pena. No cabría duda.'],
  ['Tirarian la puerta. Nos reuniriamos alli.', 'Tirarían la puerta. Nos reuniríamos allí.'],
  ['La estanteria esta llena de tonterias.', 'La estantería está llena de tonterías.'],
  ['Es una persona seria. Ella esta muy seria.', 'Es una persona seria. Ella está muy seria.'],
  ['Una situación extraordinaria y varias cosas necesarias.', 'Una situación extraordinaria y varias cosas necesarias.'],
  ['La secretaria y la funcionaria leen la prensa diaria.', 'La secretaria y la funcionaria leen la prensa diaria.'],
  // --- "Sí" afirmativo
  ['Si', 'Sí'],
  ['¡Si, tienes razón!', '¡Sí, tienes razón!'],
  ['Si, por supuesto.', 'Sí, por supuesto.'],
  ['Si... Gonta pensaba eso antes', 'Sí... Gonta pensaba eso antes'],
  ['S-Si. Tu tienes razon...', 'S-Sí. Tú tienes razón...'],
  ['Si quieres venir, avísame', 'Si quieres venir, avísame'],
  ['Si él dice eso...', 'Si él dice eso...'],
  ['Sigue así', 'Sigue así'],
  ['¿Y si...? No, olvídalo.', '¿Y si...? No, olvídalo.'],
  ['Si... si lo hubiera sabido...', 'Si... si lo hubiera sabido...'],
  ['Como si, de repente, lo supiera.', 'Como si, de repente, lo supiera.'],
  ['Creo que si.', 'Creo que sí.'],
  ['¡Kubs Pads! ¡Hay que atraparlos todos!', '¡Kubs Pads! ¡Hay que atraparlos todos!'],
  ['¡Hay! Me duele.', '¡Ay! Me duele.'],
];
let ok = 0;
for (const [entrada, esperado] of casos) {
  const r = corregir(entrada, { probables: true });
  const bien = r.texto === esperado;
  ok += bien;
  console.log(`${bien ? 'OK ' : 'MAL'} ${JSON.stringify(entrada)}\n    -> ${JSON.stringify(r.texto)}${bien ? '' : `\n    esperado ${JSON.stringify(esperado)}`}`);
}
console.log(`\n${ok}/${casos.length} correctos`);

// Sustantivos de la lista pedida: la regla de verbos NO debe tocar ninguno.
const lista = 'miseria materia serie historia categoria memoria victoria gloria armonia ironia sinfonia compania policia energia alegria filosofia fotografia biografia melancolia hipocresia democracia aristocracia burocracia estrategia tecnologia biologia geologia astronomia economia ceremonia'.split(' ');
const tocadosPorVerbo = lista.filter(w => analizar(w).some(a => /forma verbal|-ería|condicional/.test(a.mensaje)));
const corregidosComoSustantivo = lista.map(w => [w, corregir(w).texto]).filter(([a, b]) => a !== b);
console.log(`\nLista de sustantivos (${lista.length}): tocados por la regla de verbos: ${tocadosPorVerbo.length ? tocadosPorVerbo.join(', ') : 'NINGUNO'}`);
console.log(`  todos están en EXCLUIDAS: ${lista.every(w => EXCLUIDAS.has(w))}`);
console.log(`  corregidos por el diccionario de sustantivos con tilde obligatoria: ${corregidosComoSustantivo.map(([a, b]) => `${a}->${b}`).join(', ') || 'ninguno'}`);
process.exitCode = ok === casos.length && !tocadosPorVerbo.length ? 0 : 1;
