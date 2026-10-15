// comun.mjs — utilidades compartidas del pipeline v4 (bloques "##### NNNN", etiquetas, API).
import fs from 'fs';
import path from 'path';

export const TAG_RE = /<(?:CLT|PAD|DIG|RUBY)=[^>]*>/g;
export const LETRAS_ES = /[áéíóúÁÉÍÓÚñÑüÜ¿¡]/;

// Tolerante: reconoce bloques vacios y finales sin salto.
export function parseBloques(txt) {
  const partes = txt.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split(/^#####[ \t]*(\d+)[ \t]*\n?/m);
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

export function escribirBloques(entradas) {
  let out = '';
  for (const [i, t] of entradas) out += `##### ${String(i).padStart(4, '0')}\n${t}\n\n`;
  return out;
}

export const leer = (p) => fs.readFileSync(p, 'utf-8');
export function escribir(p, contenido) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, contenido, 'utf-8');
}

export function listarTxt(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listarTxt(f));
    else if (/\.txt$/i.test(e.name) && !e.name.startsWith('_')) out.push(f);
  }
  return out.sort();
}

export function contarTags(s) {
  const c = new Map();
  for (const m of s.matchAll(TAG_RE)) c.set(m[0], (c.get(m[0]) || 0) + 1);
  return c;
}
export function etiquetasOk(a, b) {
  const x = contarTags(a), y = contarTags(b);
  for (const k of new Set([...x.keys(), ...y.keys()])) if ((x.get(k) || 0) !== (y.get(k) || 0)) return false;
  return true;
}

// Un archivo "limpiado" (paso por limpiar_acentos.mjs) no tiene ni una vocal con tilde
// ni una ñ aunque tenga bastante texto (los ¿ ¡ no cuentan: anadir_signos los repone).
// Con erroresTilde (avisos seguros de tilde del verificador) tambien detecta archivos
// mezclados: muchas palabras sin tilde obligatoria y casi ninguna con tilde.
export function pareceLimpiado(texto, erroresTilde = 0) {
  const t = texto.replace(/^#####.*$/gm, '').replace(TAG_RE, '');
  const letras = (t.match(/\p{L}/gu) || []).length;
  const conTilde = (t.match(/[áéíóúÁÉÍÓÚñÑ]/g) || []).length;
  if (letras >= 200 && conTilde === 0) return true; // con menos texto es normal no tener tildes
  return erroresTilde >= 5 && conTilde < erroresTilde;
}

// ---------------------------------------------------------------- DeepSeek
export const API_URL = 'https://api.deepseek.com/chat/completions';
export function claveApi() {
  const k = process.env.DEEPSEEK_API_KEY;
  if (!k) {
    console.error('Falta la variable de entorno DEEPSEEK_API_KEY.\n  cmd:        set DEEPSEEK_API_KEY=sk-...\n  PowerShell: $env:DEEPSEEK_API_KEY="sk-..."');
    process.exit(2);
  }
  return k;
}

export async function llamarDeepSeek(messages, { modelo = 'deepseek-chat', maxTokens = 8192, temperatura = 0.3, reintentos = 3 } = {}) {
  const key = claveApi();
  let ultimo;
  for (let n = 0; n < reintentos; n++) {
    try {
      const r = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + key },
        body: JSON.stringify({ model: modelo, messages, temperature: temperatura, max_tokens: maxTokens }),
      });
      const txt = await r.text();
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}: ${txt.slice(0, 300)}`), { fatal: true });
      const j = JSON.parse(txt);
      return {
        contenido: j.choices[0].message.content ?? '',
        finish: j.choices[0].finish_reason,
        pt: j.usage?.prompt_tokens ?? 0,
        ct: j.usage?.completion_tokens ?? 0,
      };
    } catch (e) {
      ultimo = e;
      if (e.fatal) throw e;
      await new Promise(res => setTimeout(res, 2000 * (n + 1)));
    }
  }
  throw ultimo;
}

export function opciones(argv, conValor) {
  const args = argv.slice(2);
  const pos = [];
  const op = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      if (conValor.has(a) && i + 1 < args.length) op[a] = args[++i];
      else op[a] = true;
    } else pos.push(a);
  }
  return { pos, op };
}
