// recraft_kanban.mjs — Edición de los rótulos de menú de Danganronpa V3 con la API de Recraft.
//
// Flujo por cada imagen kanban_*.png:
//   1. Lee el PNG y sus dimensiones.
//   2. Genera una MÁSCARA (blanco = zona a sustituir, negro = intacto) sobre
//      la caja de texto. Por defecto cubre la banda central; se puede ajustar
//      con --box o con el mapa BOXES de abajo.
//   3. (opcional) eraseRegion  → borra el texto viejo dejando el fondo limpio.
//   4. inpaint                 → escribe el texto nuevo con el prompt dado.
//   5. Guarda máscaras, imágenes limpias y finales en la carpeta de salida.
//
// SIN DEPENDENCIAS: usa fetch y zlib nativos de Node (Node 18+).
//
// USO:
//   node recraft_kanban.mjs --dir "C:\...\INGLÉS TODAS LAS FOTOS" --dry-run
//      → solo genera las máscaras y vistas previas, SIN llamar a la API.
//
//   $env:RECRAFT_API_TOKEN = "tu_token"
//   node recraft_kanban.mjs --dir "C:\...\INGLÉS TODAS LAS FOTOS"
//      → hace eraseRegion + inpaint sobre cada kanban y guarda resultados.
//
//   node recraft_kanban.mjs --dir "C:\...\prueba_recraft" --solo-erase
//      → SOLO borra el texto (eraseRegion) y guarda el PNG limpio como
//        <out>\<nombre_original>.png  (sin inpaint, sin texto basura).
//
// OPCIONES:
//   --dir <ruta>      carpeta con los kanban_*.png  (obligatoria)
//   --out <ruta>      carpeta de salida (def.: <dir>\recraft_out)
//   --files a,b,c     procesar solo esos archivos
//   --box x,y,w,h     rectángulo de máscara (píxeles) para TODOS los archivos
//   --no-erase        no ejecutar eraseRegion (solo inpaint, más barato)
//   --solo-erase      ejecutar SOLO eraseRegion; guarda <out>\<nombre>.png
//   --dry-run         no llamar a la API; solo máscaras + vistas previas
//   --max <n>         procesar como máximo n archivos (para probar)

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// =====================================================================
// CONFIGURACIÓN
// =====================================================================

const API_BASE = 'https://external.api.recraft.ai/v1';

// Texto español por archivo. Las claves se comparan SIN extensión y sin sufijo.
const TEXTOS = {
  'kanban_new':        'NUEVO JUEGO',
  'kanban_load':       'CARGAR PARTIDA',
  'kanban_system':     'OPCIONES',
  'kanban_chapter':    'CAPÍTULOS',
  'kanban_extra':      'EXTRA',
  'kanban_rpg':        'RPG',
  'kanban_succ':       'LOGROS',
  'kanban_ainori':     'TIEMPO LIBRE',
  'kanban_close':      'CERRAR',
  'kanban_title_new':  'NUEVO JUEGO',
  'kanban_title_load': 'CARGAR PARTIDA',
  'kanban_title_quit': 'SALIR',
  'pless_any':         'PULSA CUALQUIER TECLA',
  'pless_any_key':     'PULSA CUALQUIER TECLA',
};

// Cajas de máscara por archivo (píxeles), para casos donde el texto no está
// centrado. Si un archivo no está aquí, se usa la banda central por defecto.
const BOXES = {
  // 'kanban_new': { x: 200, y: 80, w: 624, h: 96 },   // ejemplo
};

const PROMPT_BASE = 'en mayúsculas, en blanco, con la misma tipografía y estilo que el resto de la imagen, centrado';

// =====================================================================
// ARGUMENTOS
// =====================================================================

function parseArgs(argv) {
  const a = { dryRun: false, erase: true, soloErase: false, max: Infinity, files: null, box: null, dir: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--dir') { a.dir = v; i++; }
    else if (k === '--out') { a.out = v; i++; }
    else if (k === '--files') { a.files = v.split(',').map(s => s.trim()).filter(Boolean); i++; }
    else if (k === '--box') { const [x, y, w, h] = v.split(',').map(Number); a.box = { x, y, w, h }; i++; }
    else if (k === '--no-erase') { a.erase = false; a.soloErase = false; }
    else if (k === '--solo-erase') { a.soloErase = true; a.erase = false; }
    else if (k === '--dry-run') { a.dryRun = true; }
    else if (k === '--max') { a.max = Number(v); i++; }
  }
  return a;
}

const ARGS = parseArgs(process.argv.slice(2));
const TOKEN = process.env.RECRAFT_API_TOKEN;

if (!ARGS.dir) {
  console.error('Falta --dir. Uso: node recraft_kanban.mjs --dir <carpeta> [opciones]');
  process.exit(1);
}
if (!ARGS.dryRun && !TOKEN) {
  console.error('No hay token. Define $env:RECRAFT_API_TOKEN, o usa --dry-run para solo generar máscaras.');
  process.exit(1);
}

const OUT = ARGS.out || path.join(ARGS.dir, 'recraft_out');

// =====================================================================
// PNG: lectura de dimensiones y escritura de máscara (sin dependencias)
// =====================================================================

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function pngSize(buf) {
  // firma 8 B + len(4) + "IHDR"(4) + width(4) + height(4)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function makeMaskPng(width, height, box) {
  // PNG en escala de grises: 0 (negro) = intacto, 255 (blanco) = zona a sustituir
  const rowBytes = width + 1;  // +1 byte de filtro por fila
  const raw = Buffer.alloc(height * rowBytes);
  for (let y = 0; y < height; y++) {
    raw[y * rowBytes] = 0;  // filtro 0
    for (let x = 0; x < width; x++) {
      const inside = x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
      raw[y * rowBytes + 1 + x] = inside ? 255 : 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // profundidad de bit
  ihdr[9] = 0;  // tipo de color: gris
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

// Vista previa: dibuja un marco blanco sobre una copia simple del texto, para
// que veas la zona exacta sin abrir el PNG gris. (Es solo referencia visual.)
function makePreviewPng(width, height, box) {
  // Mismo gris, pero con el borde del rectángulo marcado en 128 (gris medio)
  const rowBytes = width + 1;
  const raw = Buffer.alloc(height * rowBytes);
  for (let y = 0; y < height; y++) {
    raw[y * rowBytes] = 0;
    for (let x = 0; x < width; x++) {
      const inside = x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
      const border = inside && (x < box.x + 2 || x >= box.x + box.w - 2 || y < box.y + 2 || y >= box.y + box.h - 2);
      raw[y * rowBytes + 1 + x] = inside ? (border ? 128 : 255) : 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

// =====================================================================
// DECODIFICADOR PNG mínimo (8-bit RGB/RGBA, no entrelazado) para auto-detectar
// la zona de contenido (texto) por el canal alfa. Sin dependencias.
// =====================================================================

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buf) {
  let pos = 8;  // saltar firma
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idatParts = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  if (interlace !== 0) throw new Error('PNG entrelazado no soportado');
  if (bitDepth !== 8) throw new Error('Solo PNG de 8 bits');
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (bpp === 0) throw new Error('Tipo de color no soportado (colorType=' + colorType + ')');

  const raw = zlib.inflateSync(Buffer.concat(idatParts));
  const stride = width * bpp;
  const rgba = Buffer.alloc(width * height * 4);
  const prev = Buffer.alloc(stride);
  let rp = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    const row = raw.slice(rp, rp + stride);
    rp += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v;
      switch (filter) {
        case 0: v = row[i]; break;
        case 1: v = row[i] + a; break;
        case 2: v = row[i] + b; break;
        case 3: v = row[i] + Math.floor((a + b) / 2); break;
        case 4: v = row[i] + paeth(a, b, c); break;
        default: throw new Error('Filtro desconocido: ' + filter);
      }
      row[i] = v & 0xFF;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const s = x * bpp;
      rgba[o] = row[s];
      rgba[o + 1] = row[s + 1];
      rgba[o + 2] = row[s + 2];
      rgba[o + 3] = bpp === 4 ? row[s + 3] : 255;
    }
    prev.set(row);
  }
  return { width, height, rgba };
}

// Detecta la caja de contenido (texto) como el bbox de los píxeles con alfa.
// Devuelve null si la imagen es opaca (sin canal alfa útil) o vacía.
function detectarCaja(rgba, width, height) {
  let minx = width, miny = height, maxx = 0, maxy = 0, n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = rgba[(y * width + x) * 4 + 3];
      if (a > 16) {
        n++;
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
    }
  }
  if (n === 0) return null;
  const m = 6;  // margen de seguridad en píxeles
  const x0 = Math.max(0, minx - m);
  const y0 = Math.max(0, miny - m);
  const x1 = Math.min(width, maxx + m);
  const y1 = Math.min(height, maxy + m);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// =====================================================================
// HELPERS
// =====================================================================

function dataUrl(pngBuf) {
  return 'data:image/png;base64,' + pngBuf.toString('base64');
}

function baseDe(nombre) {
  // kanban_new_US.png -> kanban_new
  return nombre.replace(/\.png$/i, '').replace(/(_US|_ef_DXT1|_DXT1|_ef)$/i, '');
}

function textoPara(nombre) {
  const base = baseDe(nombre);
  for (const [k, v] of Object.entries(TEXTOS)) {
    if (base === k || base.startsWith(k)) return v;
  }
  return null;
}

function boxPara(nombre, width, height, rgba) {
  const base = baseDe(nombre);
  if (BOXES[base]) return { auto: false, box: BOXES[base] };
  if (ARGS.box) return { auto: false, box: ARGS.box };
  // 1) Auto-detección del contenido (texto) por canal alfa
  if (rgba) {
    const caja = detectarCaja(rgba, width, height);
    if (caja) return { auto: true, box: caja };
  }
  // 2) Fallback: banda central
  return {
    auto: false,
    box: {
      x: Math.round(width * 0.05),
      y: Math.round(height * 0.20),
      w: Math.round(width * 0.90),
      h: Math.round(height * 0.60),
    },
  };
}

function extraerB64(resp) {
  // Recraft devuelve el resultado en data[0]; el campo exacto puede variar.
  const item = (resp.data && resp.data[0]) || resp.image || resp;
  if (item.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item.image && item.image.b64_json) return Buffer.from(item.image.b64_json, 'base64');
  throw new Error('No se pudo extraer b64_json de la respuesta: ' + JSON.stringify(resp).slice(0, 300));
}

async function recraft(endpoint, payload) {
  const res = await fetch(API_BASE + endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${texto.slice(0, 400)}`);
  return JSON.parse(texto);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// =====================================================================
// PROCESAMIENTO
// =====================================================================

function listarArchivos() {
  const archivos = fs.readdirSync(ARGS.dir).filter(f => /\.png$/i.test(f) && /kanban|pless/i.test(f));
  const orden = ARGS.files || null;
  const lista = orden ? orden : archivos.sort();
  return lista.filter(f => fs.existsSync(path.join(ARGS.dir, f)));
}

async function main() {
  const archivos = listarArchivos();
  if (!archivos.length) {
    console.error('No se encontraron kanban_*.png en ' + ARGS.dir);
    process.exit(1);
  }
  console.log(`Archivos a procesar: ${archivos.length}${ARGS.max < Infinity ? ` (limitado a ${ARGS.max})` : ''}`);
  console.log(`Modo: ${ARGS.dryRun ? 'SIMULACIÓN (solo máscaras)' : (ARGS.soloErase ? 'solo erase (borrar texto)' : (ARGS.erase ? 'erase + inpaint' : 'solo inpaint'))}`);
  console.log(`Salida: ${OUT}\n`);

  fs.mkdirSync(path.join(OUT, 'mascaras'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'vistas'), { recursive: true });
  if (!ARGS.dryRun) {
    fs.mkdirSync(path.join(OUT, 'limpio'), { recursive: true });
    fs.mkdirSync(path.join(OUT, 'final'), { recursive: true });
  }

  let procesados = 0;
  for (const f of archivos) {
    if (procesados >= ARGS.max) break;
    const ruta = path.join(ARGS.dir, f);
    const img = fs.readFileSync(ruta);
    const { width, height } = pngSize(img);
    const texto = ARGS.soloErase ? null : textoPara(f);

    if (!ARGS.soloErase && !texto) {
      console.log(`[SALTADO] ${f}: sin traducción conocida (añádela a TEXTOS)`);
      continue;
    }

    // Decodificar para auto-detectar la zona de contenido (texto)
    let rgba = null;
    try { rgba = decodePng(img).rgba; } catch (e) { /* se usará el fallback */ }
    const { auto, box } = boxPara(f, width, height, rgba);

    const mascara = makeMaskPng(width, height, box);
    const vista = makePreviewPng(width, height, box);
    const nombreBase = f.replace(/\.png$/i, '');

    fs.writeFileSync(path.join(OUT, 'mascaras', nombreBase + '_mask.png'), mascara);
    fs.writeFileSync(path.join(OUT, 'vistas', nombreBase + '_preview.png'), vista);

    if (ARGS.dryRun) {
      const origen = auto ? 'auto-detectada' : 'manual/por defecto';
      const accion = ARGS.soloErase ? 'solo borrar' : `texto="${texto}"`;
      console.log(`[SIMULACIÓN] ${f}  ${width}x${height}  caja=(${box.x},${box.y},${box.w},${box.h}) [${origen}]  ${accion}`);
      procesados++;
      continue;
    }

    process.stdout.write(`[PROCESANDO] ${f} ... `);

    try {
      const maskUrl = dataUrl(mascara);

      // Modo --solo-erase: borrar el texto y guardar el PNG limpio con el
      // nombre original en <out>\, sin ejecutar inpaint.
      if (ARGS.soloErase) {
        const r1 = await recraft('/images/eraseRegion', {
          image_url: dataUrl(img),
          mask_url: maskUrl,
          response_format: 'b64_json',
        });
        const limpio = extraerB64(r1);
        const destino = path.join(OUT, f);
        fs.writeFileSync(destino, limpio);
        console.log(`borrado ✓ → ${destino}`);
        procesados++;
        await sleep(500);
        continue;
      }

      let imagenParaInpaint = img;
      if (ARGS.erase) {
        const r1 = await recraft('/images/eraseRegion', {
          image_url: dataUrl(img),
          mask_url: maskUrl,
          response_format: 'b64_json',
        });
        const limpio = extraerB64(r1);
        fs.writeFileSync(path.join(OUT, 'limpio', nombreBase + '_limpio.png'), limpio);
        imagenParaInpaint = limpio;
        process.stdout.write('borrado ✓ ');
        await sleep(500);
      }

      const r2 = await recraft('/images/inpaint', {
        image_url: dataUrl(imagenParaInpaint),
        mask_url: maskUrl,
        prompt: `el texto "${texto}" ${PROMPT_BASE}`,
        response_format: 'b64_json',
      });
      const final = extraerB64(r2);
      fs.writeFileSync(path.join(OUT, 'final', nombreBase + '_final.png'), final);
      console.log('texto añadido ✓');
    } catch (e) {
      console.log('ERROR: ' + e.message);
    }
    procesados++;
    await sleep(500);  // respetar límites de peticiones
  }

  console.log(`\nListo. ${procesados} archivos procesados.`);
  console.log('Revisa las máscaras en ' + path.join(OUT, 'vistas') + ' antes de usar los resultados.');
}

main();
