// anadir_signos_apertura.mjs — anade los ¿ y ¡ de apertura que falten.
//
// Para cada ? o ! de cierre busca hacia atras el inicio de su frase (sin cruzar
// otro ? ! ni un punto final; los "..." NO cortan la frase) y, si no hay signo
// de apertura, lo inserta donde corresponde en espanol:
//   * coletilla tras coma:  "..., correcto?"   -> "..., ¿correcto?"
//   * interrogativo tras coma: "Pero, que haces?" -> "Pero, ¿que haces?"
//   * en otro caso, al inicio de la frase (tras etiquetas <CLT=...>, comillas...)
//   * ?! / !? -> ¡¿ / ¿¡ simetricos
// Casos dudosos que NO se tocan (van al informe):
//   * la frase empieza en el bloque anterior (este bloque no empieza frase)
//
// Uso: node anadir_signos_apertura.mjs <dir_entrada> <dir_salida>
// Tambien exporta arreglarSignos(texto, textoAnterior) para usarlo en el traductor.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const COLETILLAS = /^(?:verdad|no|cierto|correcto|eh|vale|ves|sabes|entiendes|de acuerdo|o no|a que s[ií]|no crees|no es as[ií]|me equivoco|s[ií])$/i;
const INTERROGATIVOS = /^(?:qu[eé]|qui[eé]n(?:es)?|c[oó]mo|d[oó]nde|ad[oó]nde|cu[aá]ndo|cu[aá]l(?:es)?|cu[aá]nt[oa]s?|por qu[eé]|para qu[eé]|acaso|en serio|de verdad)(?=[\s,.?!…]|$)/i;

// ¿El bloque anterior deja la frase abierta? (sin puntuacion final)
function continuaDelAnterior(prev) {
  if (prev == null) return false;
  const p = prev.replace(/<[^>]*>/g, '').trim();
  if (!p) return false;
  return !/[.?!…"»)\]]$/.test(p);
}

export function arreglarSignos(texto, anterior = null) {
  let s = texto;
  const cambios = [], dudosos = [];
  // Recorremos los cierres de izquierda a derecha; tras cada insercion se recalcula.
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch !== '?' && ch !== '!') { i++; continue; }
    // grupo de cierre: ?, !, ?!, !?, ???
    let j = i;
    while (j < s.length && (s[j] === '?' || s[j] === '!')) j++;
    const grupo = s.slice(i, j);
    const necesita = new Set();
    if (grupo.includes('?')) necesita.add('¿');
    if (grupo.includes('!')) necesita.add('¡');

    // inicio de la frase: hacia atras hasta ?! o un punto que no sea parte de "..."
    let k = i - 1;
    let enTag = false;
    for (; k >= 0; k--) {
      const c = s[k];
      if (c === '>') { enTag = true; continue; }
      if (c === '<' && enTag) { enTag = false; continue; }
      if (enTag) continue;
      if (c === '?' || c === '!') break;
      if (c === '.' && s[k - 1] !== '.' && s[k + 1] !== '.') break;
      // "..." / "…" seguidos de espacio y mayuscula cierran la frase anterior
      // ("Es tan tosco... Me pregunto"), pero no "¿Ha... vuelto".
      if ((c === '…' || (c === '.' && s[k - 1] === '.' && s[k + 1] !== '.')) &&
          /^[ \t\n]+(?:<[^>]*>)*["«]?[\p{Lu}¿¡]/u.test(s.slice(k + 1))) break;
    }
    const ini = k + 1;
    const frase = s.slice(ini, i);
    const yaTiene = [...necesita].filter(a => frase.includes(a));
    yaTiene.forEach(a => necesita.delete(a));
    if (!necesita.size) { i = j; continue; }

    // posicion de insercion
    let pos = ini;
    // saltar espacios, saltos, etiquetas y comillas iniciales
    const salto = /^(?:\s|<[^>]*>|["«'(\[])*/.exec(frase)[0].length;
    pos = ini + salto;
    const resto = s.slice(pos, i);
    const empiezaBloque = s.slice(0, pos).replace(/<[^>]*>|\s/g, '') === '';
    // ¿coletilla o interrogativo tras la ultima coma?
    const coma = resto.lastIndexOf(', ');
    let porComa = false;
    if (necesita.has('¿') && coma >= 0) {
      const tras = resto.slice(coma + 2).replace(/<[^>]*>/g, '').trim();
      if (COLETILLAS.test(tras) || INTERROGATIVOS.test(tras)) { pos = pos + coma + 2; porComa = true; }
    }
    if (!/\p{L}/u.test(resto)) { i = j; continue; } // "??", "!!": nada que abrir
    if (!porComa && empiezaBloque && continuaDelAnterior(anterior) &&
        /^\p{Ll}/u.test(resto.replace(/<[^>]*>/g, '').replace(/^[\s.…"«]+/, ''))) {
      dudosos.push(`la frase "${resto.slice(0, 40)}${grupo}" parece empezar en el bloque anterior`);
      i = j; continue;
    }
    // orden de apertura simetrico al cierre: "?!" -> "¡¿", "!?" -> "¿¡"
    const orden = [...grupo].reverse().map(c => (c === '?' ? '¿' : '¡')).filter((c, n, a) => a.indexOf(c) === n && necesita.has(c));
    const ins = orden.join('');
    s = s.slice(0, pos) + ins + s.slice(pos);
    cambios.push(`${ins} ante "${s.slice(pos + ins.length, pos + ins.length + 25).replace(/\n/g, ' ')}"`);
    i = j + ins.length;
  }
  return { texto: s, cambios, dudosos };
}

// ------------------------------------------------------------------ CLI
function parse(t) {
  const ps = t.replace(/\r\n/g, '\n').split(/^#####[ \t]*(\d+)[ \t]*\n?/m);
  const m = new Map();
  for (let i = 1; i + 1 < ps.length; i += 2) {
    let s = ps[i + 1] ?? '';
    if (s.endsWith('\n\n')) s = s.slice(0, -2); else if (s.endsWith('\n')) s = s.slice(0, -1);
    m.set(parseInt(ps[i], 10), s);
  }
  return m;
}

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (esPrincipal) {
  const [inDir, outDir] = process.argv.slice(2);
  if (!inDir || !outDir) { console.error('Uso: node anadir_signos_apertura.mjs <dir_entrada> <dir_salida>'); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  const informe = [];
  let nCambios = 0, nDudosos = 0, nArch = 0, sinTildes = [];
  for (const f of fs.readdirSync(inDir).filter(f => f.toLowerCase().endsWith('.txt')).sort()) {
    const m = parse(fs.readFileSync(path.join(inDir, f), 'utf-8'));
    let out = '', prev = null;
    const todo = [...m.values()].join('\n');
    if (todo.replace(/<[^>]*>/g, '').trim() && !/[áéíóúñÁÉÍÓÚÑ]/.test(todo)) sinTildes.push(f);
    for (const [id, t] of m) {
      const r = arreglarSignos(t, prev);
      for (const c of r.cambios) { informe.push(`CAMBIO\t${f}\t#${id}\t${c}`); nCambios++; }
      for (const d of r.dudosos) { informe.push(`REVISAR\t${f}\t#${id}\t${d}`); nDudosos++; }
      // garantia: solo se anaden ¿ ¡
      if (r.texto.replace(/[¿¡]/g, '') !== t.replace(/[¿¡]/g, '')) throw new Error(`alteracion inesperada en ${f} #${id}`);
      out += `##### ${String(id).padStart(4, '0')}\n${r.texto}\n\n`;
      prev = t;
    }
    fs.writeFileSync(path.join(outDir, f), out, 'utf-8');
    nArch++;
  }
  if (sinTildes.length) {
    informe.unshift(`AVISO: ${sinTildes.length} archivos sin NINGUNA tilde (seguramente pasaron por limpiar_acentos.mjs; hay que retraducirlos):\n  ${sinTildes.join('\n  ')}\n`);
  }
  fs.writeFileSync(path.join(outDir, '_informe_signos.txt'), informe.join('\n') + '\n', 'utf-8');
  console.log(`Archivos: ${nArch}  |  signos anadidos: ${nCambios}  |  casos a revisar: ${nDudosos}  |  archivos sin tildes: ${sinTildes.length}`);
  console.log(`Informe: ${path.join(outDir, '_informe_signos.txt')}`);
}
