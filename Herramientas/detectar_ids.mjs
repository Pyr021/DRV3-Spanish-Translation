import fs from 'fs';
import path from 'path';

function readIds(stxPath) {
  const buf = fs.readFileSync(stxPath);
  if (buf.toString('ascii', 0, 4) !== 'STXT') return null;
  const tableOff = buf.readUInt32LE(12);
  const tableLen = buf.readUInt32LE(20);
  const ids = [];
  for (let i = 0; i < tableLen; i++) {
    const entryPos = tableOff + i * 8;
    ids.push(buf.readUInt32LE(entryPos));
  }
  return ids;
}

function walk(dir) {
  const results = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) results.push(...walk(full));
    else if (item.isFile() && item.name.toLowerCase().endsWith('.stx')) results.push(full);
  }
  return results;
}

const dir = process.argv[2];
const stxFiles = walk(dir);
let secuenciales = 0, noSecuenciales = 0;

for (const file of stxFiles) {
  const ids = readIds(file);
  if (!ids) continue;
  let esSecuencial = true;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] !== i) { esSecuencial = false; break; }
  }
  if (esSecuencial) {
    secuenciales++;
  } else {
    noSecuenciales++;
    console.log(`NO SECUENCIAL: ${path.basename(file)} (${ids.length} ids, ej: ${ids.slice(0, 5).join(',')}...)`);
  }
}

console.log(`\nSecuenciales: ${secuenciales}, No secuenciales: ${noSecuenciales}`);