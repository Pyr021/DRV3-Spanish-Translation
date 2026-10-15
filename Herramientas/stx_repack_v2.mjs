import fs from 'fs';
import path from 'path';

// Uso: node stx_repack_v2.mjs <carpeta_txt_traducidos> <carpeta_stx_originales> <carpeta_salida>

function parseTxt(content) {
  const normalized = content.replace(/\r\n/g, '\n');
  const parts = normalized.split(/^##### /m);
  const strings = [];
  for (let i = 1; i < parts.length; i++) {
    const nlIndex = parts[i].indexOf('\n');
    if (nlIndex === -1) continue;
    const index = parseInt(parts[i].substring(0, nlIndex), 10);
    let text = parts[i].substring(nlIndex + 1);
    if (text.endsWith('\n\n')) text = text.slice(0, -2);
    else if (text.endsWith('\n')) text = text.slice(0, -1);
    strings[index] = text;
  }
  return strings;
}

function readOriginalIds(stxPath) {
  const buf = fs.readFileSync(stxPath);
  if (buf.toString('ascii', 0, 4) !== 'STXT') throw new Error('No es STX');
  const tableOff = buf.readUInt32LE(12);
  const tableLen = buf.readUInt32LE(20);
  const ids = [];
  for (let i = 0; i < tableLen; i++) {
    const entryPos = tableOff + i * 8;
    const id = buf.readUInt32LE(entryPos);
    ids.push(id);
  }
  return ids;
}

function repackStx(strings, ids) {
  const tableLen = strings.length;
  const tableOff = 0x20;

  // Construir los strings en orden de tabla (0, 1, 2, ...) con sus offsets
  const stringBuffers = [];
  const offsets = [];
  let currentOffset = tableOff + tableLen * 8;
  for (let i = 0; i < tableLen; i++) {
    offsets.push(currentOffset);
    const strBuf = Buffer.from(strings[i] || '', 'utf16le');
    const withNull = Buffer.concat([strBuf, Buffer.from([0, 0])]);
    stringBuffers.push(withNull);
    currentOffset += withNull.length;
  }

  const header = Buffer.alloc(32);
  header.write('STXT', 0, 'ascii');
  header.write('JPLL', 4, 'ascii');
  header.writeUInt32LE(0x01, 8);
  header.writeUInt32LE(tableOff, 12);
  header.writeUInt32LE(0x08, 16);
  header.writeUInt32LE(tableLen, 20);

  const tableBuffs = [];
  for (let i = 0; i < tableLen; i++) {
    const entry = Buffer.alloc(8);
    // AQUÍ ESTÁ LA CLAVE: usar el ID original en lugar de "i"
    entry.writeUInt32LE(ids[i] !== undefined ? ids[i] : i, 0);
    entry.writeUInt32LE(offsets[i], 4);
    tableBuffs.push(entry);
  }

  return Buffer.concat([header, ...tableBuffs, ...stringBuffers]);
}

function walkTxtFiles(dir) {
  const results = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) results.push(...walkTxtFiles(full));
    else if (item.isFile() && item.name.toLowerCase().endsWith('.txt')) results.push(full);
  }
  return results;
}

const [,, inputDir, origStxDir, outputDir] = process.argv;
if (!inputDir || !origStxDir || !outputDir) {
  console.error('Uso: node stx_repack_v2.mjs <carpeta_txt> <carpeta_stx_originales> <carpeta_salida>');
  process.exit(1);
}

const txtFiles = fs.statSync(inputDir).isDirectory() ? walkTxtFiles(inputDir) : [inputDir];
console.log(`Encontrados ${txtFiles.length} archivos .txt`);

let ok = 0, fail = 0;

for (const txtFile of txtFiles) {
  try {
    const rel = path.relative(inputDir, txtFile);
    const stxName = rel.replace(/\.txt$/i, '.stx');
    const origStxPath = path.join(origStxDir, stxName);
    if (!fs.existsSync(origStxPath)) {
      console.error(`SKIP ${rel}: no se encuentra el original ${origStxPath}`);
      fail++;
      continue;
    }

    const ids = readOriginalIds(origStxPath);
    const content = fs.readFileSync(txtFile, 'utf-8');
    const strings = parseTxt(content);
    const stxBuf = repackStx(strings, ids);

    const outFile = path.join(outputDir, stxName);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, stxBuf);
    ok++;
  } catch (e) {
    console.error(`ERROR en ${txtFile}: ${e.message}`);
    fail++;
  }
}

console.log(`\nListo. ${ok} OK, ${fail} fallos.`);
console.log(`Salida: ${outputDir}`);