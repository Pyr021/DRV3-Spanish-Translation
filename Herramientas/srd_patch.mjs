import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Uso: node srd_patch.mjs <srd_path> <srdv_path> <png_dir> <out_dir>
const [,, srdPath, srdvPath, pngDir, outDir] = process.argv;
if (!srdPath || !srdvPath || !pngDir || !outDir) {
  console.error('Uso: node srd_patch.mjs <srd> <srdv> <png_dir> <out_dir>');
  process.exit(1);
}

// ==== 1. Parsear el SRD ====
function parseSrd(filePath) {
  const buf = fs.readFileSync(filePath);
  let pos = 0;
  const textures = [];

  while (pos < buf.length) {
    if (buf[pos] !== 0x24) break;
    const type = buf.slice(pos, pos + 4).toString('ascii');
    pos += 4;
    const dataLen = buf.readUInt32BE(pos); pos += 4;
    const subLen = buf.readUInt32BE(pos); pos += 4;
    pos += 4;
    const dataPad = (0x10 - dataLen % 0x10) % 0x10;
    const subPad = (0x10 - subLen % 0x10) % 0x10;
    const data = buf.slice(pos, pos + dataLen);
    pos += dataLen + dataPad;
    const subdata = buf.slice(pos, pos + subLen);
    pos += subLen + subPad;

    if (type !== '$TXR') continue;

    const dispW = data.readUInt16LE(6);
    const dispH = data.readUInt16LE(8);
    const fmt = data.readUInt8(12);

    let sp = 4;
    const innerDataLen = subdata.readUInt32BE(sp); sp += 4;
    sp += 8;
    const innerDataPad = (0x10 - innerDataLen % 0x10) % 0x10;
    const innerData = subdata.slice(sp, sp + innerDataLen);

    let ip = 16;
    const mipStart = innerData.readUInt32LE(ip) & 0x0FFFFFFF; ip += 4;
    const mipLen = innerData.readUInt32LE(ip); ip += 4;
    const nameOffset = innerData.readUInt32LE(12);
    let nameEnd = nameOffset;
    while (nameEnd < innerData.length && innerData[nameEnd] !== 0) nameEnd++;
    const name = innerData.slice(nameOffset, nameEnd).toString('utf-8');

    textures.push({ name, offset: mipStart, len: mipLen, width: dispW, height: dispH, fmt });
  }
  return textures;
}

// ==== 2. Trim + resize con ImageMagick + codificar con texconv ====
function encodePng(pngPath, outDir, width, height, fmt) {
  const fmtName = fmt === 0x0F ? 'BC1_UNORM' : 'BC7_UNORM';
  const tmpDir = path.join(outDir, 'texconv_tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  // Paso 1: trim + resize forzado con ImageMagick
  const paddedPath = path.join(tmpDir, path.basename(pngPath, '.png') + '_padded.png');
  const magickCmd = `magick "${pngPath}" -resize "${width}x${height}!" "${paddedPath}"`;
  execSync(magickCmd, { stdio: 'pipe' });

  // Paso 2: Codificar a DXT1/BC7 con texconv
  const cmd = `texconv -f ${fmtName} -m 1 -y -o "${tmpDir}" "${paddedPath}"`;
  execSync(cmd, { stdio: 'pipe' });

  const baseName = path.basename(paddedPath, '.png');
  const ddsPath = path.join(tmpDir, baseName + '.dds');
  const dds = fs.readFileSync(ddsPath);

  const magic = dds.slice(84, 88).toString('ascii');
  const headerSize = magic === 'DX10' ? 148 : 128;

  return dds.slice(headerSize);
}

// ==== 3. Aplicar parches al SRDV ====
const textures = parseSrd(srdPath);
const srdv = fs.readFileSync(srdvPath);
const srdvPatched = Buffer.from(srdv);

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let patched = 0, skipped = 0, errors = 0;

for (const t of textures) {
  const pngPath = path.join(pngDir, t.name);

  if (!fs.existsSync(pngPath)) {
    console.log(`[SKIP] ${t.name} (PNG no encontrado)`);
    skipped++;
    continue;
  }

  try {
    console.log(`[PATCH] ${t.name} (${t.width}x${t.height}, fmt=0x${t.fmt.toString(16)})`);
    const compressed = encodePng(pngPath, outDir, t.width, t.height, t.fmt);

    if (compressed.length !== t.len) {
      console.error(`  !! Tamaño incorrecto: esperado ${t.len}, obtenido ${compressed.length}`);
      errors++;
      continue;
    }

    compressed.copy(srdvPatched, t.offset);
    console.log(`  OK (${compressed.length} bytes en offset 0x${t.offset.toString(16)})`);
    patched++;
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
    errors++;
  }
}

// Guardar SRDV parcheado
const outSrdv = path.join(outDir, path.basename(srdvPath));
fs.writeFileSync(outSrdv, srdvPatched);
console.log(`\n=== RESUMEN ===`);
console.log(`Patched: ${patched}, Skipped: ${skipped}, Errors: ${errors}`);
console.log(`SRDV modificado: ${outSrdv}`);

const outSrd = path.join(outDir, path.basename(srdPath));
fs.copyFileSync(srdPath, outSrd);
console.log(`SRD copiado: ${outSrd}`);