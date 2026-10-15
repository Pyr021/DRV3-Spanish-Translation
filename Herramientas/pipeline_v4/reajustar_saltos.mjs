// reajustar_saltos.mjs — REAJUSTE DE SALTOS DE LINEA (v3, consciente de la caja)
//
// v2 repartia cada linea traducida al ancho (en caracteres) de la linea inglesa
// mas ancha. Como el espanol es mas largo, CREABA lineas de mas: "¿Donde os
// escondeis...?" acababa en 2 lineas, y entradas de 2 lineas acababan en 3 o 4,
// que la caja no muestra.
//
// v3 trabaja contra la CAJA DE DIALOGO, no contra el original:
//   * Ancho medido en PIXELES con las metricas reales de v3_font00 (incluidas
//     las letras espanolas anadidas). Las etiquetas <CLT=...> no ocupan.
//   * Maximo de lineas = --max-lineas (def. 3: lo que muestra la caja segun la
//     prueba en el juego; el ingles nunca usa mas de 2).
//   * NO hay auto-fit en el motor (ver README_DESBORDAMIENTO.md): lo que no quepa
//     aqui se vera cortado. Por eso el informe lista TODAS las que no caben.
//   * Reflujo completo de la entrada: usa las minimas lineas posibles y las
//     equilibra (programacion dinamica) para que tengan anchos parecidos.
//   * Si no cabe, ensancha poco a poco desde --ancho hasta --ancho-max.
//   * Si aun no cabe: acorta quitando muletillas seguras (realmente,
//     simplemente, en realidad...) y, con --acortar-ia, pide a DeepSeek una
//     version mas corta (validada: mismas etiquetas y que quepa).
//   * Bocadillos de debate (originales con mas de --max-lineas lineas o con
//     etiquetas <CLT=size..>): se conserva su numero de lineas y se equilibra.
//   * Todo lo que no sea mover saltos queda registrado en _informe_reajuste.txt.
//
// Uso:
//   node reajustar_saltos.mjs <dir_original> <dir_traducido> <dir_salida> [opciones]
//
// Opciones:
//   --max-lineas N   Lineas visibles de la caja (def. 3)
//   --metricas F     JSON de avances de otra fuente (escalar_fuente.py)
//   --ancho N        Ancho de linea objetivo en px (def. 1180, el del ingles)
//   --ancho-max N    Ancho maximo tolerado en px antes de acortar (def. 1300)
//   --paso N         Incremento de ancho en px (def. 20)
//   --sin-acortar    No quitar muletillas
//   --acortar-ia     Ultimo recurso: acortar con DeepSeek (usa DEEPSEEK_API_KEY)
//   --solo a.txt,b   Procesar solo esos archivos

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Avance horizontal (lb + ancho + rb) de cada glifo de v3_font00 parcheada.
let ADV = {"0":33,"1":33,"2":33,"3":33,"4":33,"5":33,"6":33,"7":33,"8":33,"9":33," ":16,"!":15,"\"":17,"#":31,"$":32,"%":42,"&":40,"'":16,"(":20,")":20,"*":24,"+":34,",":13,"-":22,".":13,"/":18,":":13,";":13,"<":28,"=":34,">":28,"?":29,"@":43,"A":36,"B":36,"C":36,"D":39,"E":33,"F":32,"G":38,"H":39,"I":14,"J":27,"K":33,"L":32,"M":45,"N":39,"O":42,"P":36,"Q":42,"R":36,"S":32,"T":35,"U":39,"V":35,"W":48,"X":36,"Y":34,"Z":33,"[":21,"\\":18,"]":21,"^":29,"_":23,"`":17,"a":28,"b":31,"c":28,"d":32,"e":28,"f":20,"g":29,"h":30,"i":13,"j":14,"k":27,"l":14,"m":45,"n":30,"o":31,"p":31,"q":31,"r":21,"s":25,"t":19,"u":30,"v":26,"w":42,"x":27,"y":27,"z":25,"{":18,"|":17,"}":18,"~":24,"¡":15,"ª":20,"«":25,"®":41,"º":21,"»":25,"¿":29,"Á":36,"É":33,"Í":14,"Ñ":39,"Ó":42,"×":45,"Ú":39,"Ü":39,"á":28,"é":28,"í":13,"ñ":30,"ó":31,"ú":30,"ü":30,"—":45,"―":45,"’":13,"…":45,"※":45,"℠":48,"™":45,"←":45,"→":45,"⇔":45,"■":45,"□":45,"▲":45,"△":45,"○":45,"●":45,"☆":45,"♪":45,"　":45};
const TAG = /<[A-Za-z]+=[^>]*>/g;

export function anchoPx(s) {
  let w = 0;
  for (const ch of s.replace(TAG, '').replace(/\u0001/g, '')) w += ADV[ch] ?? (ch.codePointAt(0) >= 0x2E80 ? 45 : 30);
  return w;
}
export const anchoVisual = anchoPx; // compatibilidad con v2

// ------------------------------------------------------------------ opciones
const args = process.argv.slice(2);
const VALOR = new Set(['--max-lineas', '--ancho', '--ancho-max', '--paso', '--solo', '--metricas']);
const opcion = (n, def) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
// --metricas metricas.json : avances de otra fuente (p. ej. la v3_font00 reducida de escalar_fuente.py)
if (opcion('--metricas', '')) ADV = JSON.parse(fs.readFileSync(opcion('--metricas', ''), 'utf-8')).adv;
const MAX_LINEAS = parseInt(opcion('--max-lineas', '3'), 10);
const ANCHO = parseInt(opcion('--ancho', '1180'), 10);
const ANCHO_MAX = parseInt(opcion('--ancho-max', '1300'), 10);
const PASO = Math.max(1, parseInt(opcion('--paso', '20'), 10));
const SIN_ACORTAR = args.includes('--sin-acortar');
const ACORTAR_IA = args.includes('--acortar-ia');
const SOLO = opcion('--solo', '') ? opcion('--solo', '').split(',').map(s => s.trim()) : null;

// ------------------------------------------------------------------ parseo
function parse(t) {
  const ps = t.replace(/\r\n/g, '\n').split(/^#####[ \t]*(\d+)[ \t]*\n?/m);
  const m = new Map();
  for (let i = 1; i + 1 < ps.length; i += 2) {
    const idx = parseInt(ps[i], 10);
    if (Number.isNaN(idx)) continue;
    let s = ps[i + 1] ?? '';
    if (s.endsWith('\n\n')) s = s.slice(0, -2);
    else if (s.endsWith('\n')) s = s.slice(0, -1);
    m.set(idx, s);
  }
  return m;
}
const tokens = (s) => s.split(/\s+/).filter(x => x !== '');
const lineasUtiles = (s) => s.split('\n').filter(l => l.replace(TAG, '').trim() !== '');

// ------------------------------------------------------------------ reparto
// Minimo de lineas con ancho W (voraz: es optimo para el recuento).
function minLineas(ws, W) {
  let n = 1, acc = -1;
  for (const w of ws) {
    if (acc < 0) acc = w;
    else if (acc + ADV[' '] + w <= W) acc += ADV[' '] + w;
    else { n++; acc = w; }
  }
  return n;
}

// Reparto en exactamente k lineas, todas <= W (W=Infinity: sin limite),
// minimizando la suma de cuadrados de los anchos -> lineas equilibradas.
function equilibrar(ps, k, W = Infinity) {
  const n = ps.length;
  k = Math.min(k, n);
  const ws = ps.map(anchoPx);
  const pre = [0];
  for (const w of ws) pre.push(pre.at(-1) + w);
  const anchoTramo = (a, b) => pre[b] - pre[a] + ADV[' '] * (b - a - 1);
  // Preferencias tipograficas al cortar tras la palabra ps[i-1]:
  // final de frase o coma = bonificacion; articulo/preposicion suelta = castigo.
  const R = anchoTramo(0, n) / Math.max(1, k);
  const corte = (i) => {
    if (i >= n) return 0;
    const p = ps[i - 1].replace(TAG, '');
    if (/[.!?…]["»)]*$/.test(p)) return -0.12 * R * R;
    if (/[,;:]$/.test(p)) return -0.05 * R * R;
    if (/^(?:a|al|de|del|el|la|las|los|lo|un|una|y|e|o|u|en|con|por|para|que|me|te|se|le|les|mi|tu|su|no|ni)$/i.test(p)) return 0.10 * R * R;
    return 0;
  };
  const INF = Infinity;
  const dp = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(INF));
  const de = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(-1));
  dp[0][0] = 0;
  for (let l = 1; l <= k; l++) {
    for (let i = l; i <= n; i++) {
      for (let j = l - 1; j < i; j++) {
        if (dp[l - 1][j] === INF) continue;
        const w = anchoTramo(j, i);
        if (w > W) continue;
        const c = dp[l - 1][j] + w * w + corte(i);
        if (c < dp[l][i]) { dp[l][i] = c; de[l][i] = j; }
      }
    }
  }
  if (dp[k][n] === INF) return null;
  const out = [];
  for (let i = n, l = k; l > 0; l--) { const j = de[l][i]; out.push(ps.slice(j, i).join(' ')); i = j; }
  return out.reverse();
}

// Reparto normal: minimas lineas a ancho W, equilibradas. null si no cabe.
function repartir(ps, W, maxL) {
  if (ps.length === 0) return [''];
  const ws = ps.map(anchoPx);
  if (Math.max(...ws) > W) return null;
  const k = minLineas(ws, W);
  if (k > maxL) return null;
  return k === 1 ? [ps.join(' ')] : equilibrar(ps, k, W);
}

// Cadenas unidas por guiones ("PUEDES-GANAR-UN-MONTON-DE-...", habla del robot):
// se trocean en piezas "PUEDES-" + PEGA para poder cortar linea tras un guion.
const PEGA = '\u0001';
function trocearGuiones(ps) {
  return ps.flatMap(t => {
    if ((t.match(/-/g) || []).length < 2) return [t];
    const partes = t.split(/(?<=-)/);
    return partes.map((p, k) => (k < partes.length - 1 ? p + PEGA : p));
  });
}
const unirPegados = (l) => l.replace(new RegExp(PEGA + ' ', 'g'), '').replace(new RegExp(PEGA, 'g'), '');
// "MONOCOINS-Y-\nCAMBIARLOS-POR" es UNA cadena con guiones partida en dos lineas: se une.
// "la unica superviviente-\narriesgo" es un guion de inciso seguido de otra palabra: NO se une.
// Criterio: se une solo si el trozo de antes o el de despues tienen otro guion.
export function unirCadenasGuion(s) {
  return s.replace(/(\S+)-\n(\S+)/g, (m, a, b) => (a.includes('-') || b.includes('-')) ? `${a}-${b}` : m);
}

function ajustar(texto, maxL) {
  const t = unirCadenasGuion(texto);
  for (const ps of [tokens(t), trocearGuiones(tokens(t))]) {
    for (let W = ANCHO; W <= ANCHO_MAX; W += PASO) {
      const r = repartir(ps, W, maxL);
      if (r) return { lineas: r.map(unirPegados), W };
    }
  }
  return null;
}

// ------------------------------------------------------------------ acortado
// Muletillas que se pueden quitar sin cambiar el sentido. Orden = preferencia.
const MULETILLAS = [
  /\bla verdad es que /i, /\ben realidad,? /i, /\brealmente /i, /\bsimplemente /i,
  /\bverdaderamente /i, /\bsinceramente,? /i, /\bpor supuesto,? /i, /\bpues bien,? /i,
  /\bes decir,? /i, /\bbueno,? /i, /\bmuy /i, /\bbastante /i,
  // NO se incluyen "solo", "ya", "justo", "todavia": cambian el sentido.
];
function quitarMuletilla(s, re) {
  const m = re.exec(s);
  if (!m) return null;
  const antes = s.slice(0, m.index);
  let despues = s.slice(m.index + m[0].length);
  if (!despues.trim()) return null;
  // Si la muletilla iniciaba frase, la siguiente palabra pasa a mayuscula.
  const inicioFrase = /(^|[.!?…]\s+|[¿¡]|^(?:<[^>]*>)+)$/.test(antes) && /^[A-ZÁÉÍÓÚÑ¿¡]/.test(m[0]);
  if (inicioFrase) despues = despues.replace(/^((?:<[^>]*>|[¿¡"«(])*)(\p{Ll})/u, (x, t, c) => t + c.toUpperCase());
  return antes + despues;
}
function acortarMuletillas(texto, maxL) {
  let s = texto;
  const quitadas = [];
  for (const re of MULETILLAS) {
    let t;
    while ((t = quitarMuletilla(s, re)) !== null) {
      quitadas.push(re.source.replace(/\\b|\\s|[?,]|\(\?:|\)/g, '').trim());
      s = t;
      const r = ajustar(s, maxL);
      if (r) return { texto: s, r, quitadas };
    }
  }
  return null;
}

const API_KEY = process.env.DEEPSEEK_API_KEY || '';
async function acortarIA(texto, maxL) {
  const px = anchoPx(texto);
  const objetivoPx = ANCHO_MAX * maxL * 0.92;
  const maxChars = Math.floor(texto.replace(TAG, '').length * objetivoPx / px);
  const etiquetas = (s) => (s.match(TAG) || []).join('|');
  for (let intento = 0; intento < 2; intento++) {
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + API_KEY },
      body: JSON.stringify({
        model: 'deepseek-chat', temperature: 0.2, max_tokens: 400,
        messages: [
          { role: 'system', content: 'Eres corrector de una traduccion al espanol de Espana de Danganronpa V3. Acortas frases de dialogo sin cambiar su significado, tono ni personaje. Conservas tildes, ¿ ¡ y las etiquetas <...> exactamente iguales y en el mismo orden. Devuelves SOLO el texto acortado, en una sola linea.' },
          { role: 'user', content: `Acorta a un maximo de ${maxChars} caracteres (sin contar etiquetas). Ahora tiene ${texto.replace(TAG, '').length}.\n\n${texto.replace(/\n/g, ' ')}` },
        ],
      }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = JSON.parse(await r.text());
    const s = (j.choices?.[0]?.message?.content ?? '').trim().replace(/^"|"$/g, '');
    if (!s || etiquetas(s) !== etiquetas(texto)) continue;
    const a = ajustar(s, maxL);
    if (a) return { texto: s, r: a };
  }
  return null;
}

// ------------------------------------------------------------------ entrada
async function procesar(orig, trad) {
  if (!trad.trim()) return { texto: trad, tipo: 'vacia' };
  const nOrig = lineasUtiles(orig).length;
  const especial = nOrig > MAX_LINEAS || /<CLT=size/i.test(orig);

  if (especial) {
    // Bocadillo de debate: si el traductor ya respeto el numero de lineas del
    // original, no se toca (la maquetacion de los debates es deliberada).
    // Si no, se reparte en ese mismo numero de lineas, equilibradas.
    if (lineasUtiles(trad).length === nOrig) return { texto: trad, tipo: 'especial-intacta' };
    const ps = tokens(trad);
    const r = equilibrar(ps, Math.max(1, nOrig)) || [ps.join(' ')];
    return { texto: r.join('\n'), tipo: 'especial' };
  }

  const a = ajustar(trad, MAX_LINEAS);
  if (a) return { texto: a.lineas.join('\n'), tipo: a.W > ANCHO ? 'ensanchada' : 'ok', W: a.W };

  if (!SIN_ACORTAR) {
    const m = acortarMuletillas(trad, MAX_LINEAS);
    if (m) return { texto: m.r.lineas.join('\n'), tipo: 'acortada', W: m.r.W, detalle: `quitado: ${m.quitadas.join(', ')}` };
  }
  if (ACORTAR_IA && API_KEY) {
    try {
      const m = await acortarIA(trad, MAX_LINEAS);
      if (m) return { texto: m.r.lineas.join('\n'), tipo: 'acortada-ia', W: m.r.W, detalle: 'reescrita por IA' };
    } catch (e) { console.warn(`   aviso IA: ${e.message}`); }
  }
  // No cabe: se deja en MAX_LINEAS lineas equilibradas (desborda a lo ancho) y se avisa.
  const ps = tokens(trad);
  const r = equilibrar(ps, MAX_LINEAS) || [ps.join(' ')];
  return { texto: r.join('\n'), tipo: 'no-cabe', W: Math.max(...r.map(anchoPx)) };
}

// Garantia de que el reajuste solo ha movido espacios/saltos:
//   1. la secuencia de caracteres sin espacios es identica (ni una letra cambia)
//   2. toda separacion entre palabras del original sigue existiendo en la salida
//      (no se han pegado dos palabras), salvo las cadenas con guiones que el original
//      ya partia con "-\n" ("MONTON-\nDE" = "MONTON-DE")
//   3. las separaciones nuevas solo pueden ir justo despues de un guion
export function mismoTexto(antes, despues) {
  const huecos = (s) => { // posiciones (en la secuencia sin espacios) donde hay separacion
    const set = new Set(); let n = 0, sep = false, prev = '';
    for (const ch of s) {
      if (/\s/.test(ch)) { sep = true; continue; }
      if (sep && n > 0) set.add(n + (prev === '-' ? ':g' : ''));
      sep = false; prev = ch; n++;
    }
    return set;
  };
  const a = unirCadenasGuion(antes);
  if (a.replace(/\s+/g, '') !== despues.replace(/\s+/g, '')) return false;
  const ha = huecos(a), hb = huecos(despues);
  for (const h of ha) if (!hb.has(h)) return false;                               // palabra pegada
  for (const h of hb) if (!ha.has(h) && !String(h).endsWith(':g')) return false;   // corte nuevo no tras guion
  return true;
}

// ------------------------------------------------------------------ main
// Solo se ejecuta al lanzarlo directamente (se puede importar anchoPx sin efectos).
const esPrincipal = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (esPrincipal) await main();

async function main() {
const [origDir, tradDir, outDir] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALOR.has(args[i - 1])));
if (!origDir || !tradDir || !outDir) {
  console.error('Uso: node reajustar_saltos.mjs <dir_original> <dir_traducido> <dir_salida> [--max-lineas 2] [--ancho 1180] [--ancho-max 1300] [--sin-acortar] [--acortar-ia] [--solo a.txt]');
  process.exit(1);
}
if (ACORTAR_IA && !API_KEY) console.warn('AVISO: --acortar-ia sin DEEPSEEK_API_KEY; se omite el acortado por IA.');

let files = fs.readdirSync(origDir).filter(f => f.toLowerCase().endsWith('.txt')).sort();
if (SOLO) files = files.filter(f => SOLO.includes(f));

const cuenta = {};
const informe = [];
const alteradas = [];
const sinTraduccion = [];
let archivos = 0;

for (const f of files) {
  const tradPath = path.join(tradDir, f);
  if (!fs.existsSync(tradPath)) { sinTraduccion.push(f); continue; }
  const A = parse(fs.readFileSync(path.join(origDir, f), 'utf-8'));
  const B = parse(fs.readFileSync(tradPath, 'utf-8'));
  const out = [];
  for (const [i, orig] of A) {
    const trad = B.has(i) ? B.get(i) : orig;
    const r = await procesar(orig, trad);
    cuenta[r.tipo] = (cuenta[r.tipo] || 0) + 1;

    // Garantia: salvo acortado explicito, solo se han movido espacios y saltos.
    const igual = mismoTexto(trad, r.texto);
    if (!igual && !r.tipo.startsWith('acortada')) alteradas.push(`${f} [${i}]`);
    if (['acortada', 'acortada-ia', 'no-cabe', 'especial'].includes(r.tipo)) {
      informe.push(`${r.tipo.toUpperCase()}\t${f}\t#${i}\t${r.W ? r.W + 'px\t' : ''}${r.detalle ?? ''}\n  ANTES: ${JSON.stringify(trad)}\n  AHORA: ${JSON.stringify(r.texto)}`);
    }
    out.push(`##### ${String(i).padStart(4, '0')}\n${r.texto}\n\n`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, f), out.join(''), 'utf-8');
  archivos++;
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, '_informe_reajuste.txt'), informe.join('\n\n') + '\n', 'utf-8');

console.log('='.repeat(78));
console.log(`REAJUSTE DE SALTOS v3  (caja: ${MAX_LINEAS} lineas, ${ANCHO}-${ANCHO_MAX}px)`);
console.log('='.repeat(78));
console.log(`Archivos procesados          : ${archivos}`);
console.log(`Caben al ancho base          : ${cuenta.ok || 0}`);
console.log(`Caben ensanchando (<=${ANCHO_MAX}px) : ${cuenta.ensanchada || 0}`);
console.log(`Acortadas (muletillas)       : ${cuenta.acortada || 0}`);
console.log(`Acortadas (IA)               : ${cuenta['acortada-ia'] || 0}`);
console.log(`Debate (intactas/repartidas) : ${cuenta['especial-intacta'] || 0}/${cuenta.especial || 0}`);
console.log(`NO CABEN (revisar a mano)    : ${cuenta['no-cabe'] || 0}`);
console.log(`Palabras alteradas sin aviso : ${alteradas.length}`);
if (sinTraduccion.length) console.log(`Archivos sin traduccion      : ${sinTraduccion.length}`);
console.log(`Informe: ${path.join(outDir, '_informe_reajuste.txt')}`);
if (alteradas.length) {
  console.log('\n*** ERROR: el reajuste cambio texto sin acortado explicito. NO usar. ***');
  console.log('  ' + alteradas.slice(0, 10).join('\n  '));
  process.exitCode = 1;
}
}
