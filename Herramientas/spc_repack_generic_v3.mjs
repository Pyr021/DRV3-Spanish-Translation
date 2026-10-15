import fs from 'fs';
import path from 'path';
import { spcCmp } from './spc_cmp.mjs';

const [,, inputDir, origSpcPath, outSpc] = process.argv;
if (!inputDir || !origSpcPath || !outSpc) {
  console.error('Uso: node spc_repack_generic_v3.mjs <carpeta_archivos> <spc_original> <spc_salida>');
  process.exit(1);
}

function parseSpcInfo(buf) {
  if (buf.toString('ascii', 0, 4) !== 'CPS.') throw new Error('No es SPC');
  let pos = 4;
  pos += 0x24;
  const fileCount = buf.readUInt32LE(pos); pos += 4;
  pos += 4;
  pos += 0x10;
  pos += 0x04;
  pos += 0x0C;

  const subfiles = [];
  for (let i = 0; i < fileCount; i++) {
    const cmpFlag = buf.readUInt16LE(pos); pos += 2;
    const unkFlag = buf.readUInt16LE(pos); pos += 2;
    const cmpSize = buf.readUInt32LE(pos); pos += 4;
    const decSize = buf.readUInt32LE(pos); pos += 4;
    const nameLen = buf.readUInt32LE(pos); pos += 4;
    pos += 0x10;
    const namePadding = (0x10 - (nameLen + 1) % 0x10) % 0x10;
    const dataPadding = (0x10 - cmpSize % 0x10) % 0x10;
    const filename = buf.toString('utf-8', pos, pos + nameLen);
    pos += nameLen + namePadding + 1;
    pos += cmpSize + dataPadding;
    subfiles.push({ filename, cmpFlag, unkFlag });
  }
  return subfiles;
}

function packSpc(subfiles, outPath) {
  const parts = [];
  parts.push(Buffer.from('CPS.', 'ascii'));
  const unk1 = Buffer.alloc(0x24, 0);
  unk1[4] = 0xFF; unk1[5] = 0xFF; unk1[6] = 0xFF; unk1[7] = 0xFF;
  unk1[8] = 0xFF; unk1[9] = 0xFF; unk1[10] = 0xFF; unk1[11] = 0xFF;
  parts.push(unk1);

  const fileCountBuf = Buffer.alloc(4);
  fileCountBuf.writeUInt32LE(subfiles.length);
  parts.push(fileCountBuf);
  const unk2Buf = Buffer.alloc(4);
  unk2Buf.writeUInt32LE(4);
  parts.push(unk2Buf);
  parts.push(Buffer.alloc(0x10, 0));
  parts.push(Buffer.from('Root', 'ascii'));
  parts.push(Buffer.alloc(0x0C, 0));

  for (const sf of subfiles) {
    let stored, cmpSize, decSize, cmpFlag;
    if (sf.cmpFlag === 1) {
      stored = sf.data;
      cmpSize = sf.data.length;
      decSize = sf.data.length;
      cmpFlag = 1;
    } else {
      stored = spcCmp(sf.data);
      cmpSize = stored.length;
      decSize = sf.data.length;
      cmpFlag = 2;
    }

    const nameBuf = Buffer.from(sf.filename, 'utf-8');
    const namePadding = (0x10 - (nameBuf.length + 1) % 0x10) % 0x10;
    const dataPadding = (0x10 - cmpSize % 0x10) % 0x10;

    const header = Buffer.alloc(0x20);
    header.writeUInt16LE(cmpFlag, 0);
    header.writeUInt16LE(sf.unkFlag, 2);
    header.writeUInt32LE(cmpSize, 4);
    header.writeUInt32LE(decSize, 8);
    header.writeUInt32LE(nameBuf.length, 12);

    parts.push(header);
    parts.push(nameBuf);
    parts.push(Buffer.alloc(namePadding + 1, 0));
    parts.push(stored);
    parts.push(Buffer.alloc(dataPadding, 0));

    const ratio = cmpFlag === 1 ? 'raw' : `${((1 - stored.length / sf.data.length) * 100).toFixed(1)}%`;
    console.log(`  ${sf.filename}: ${sf.data.length} → ${stored.length} bytes (flag=${cmpFlag} ${ratio})`);
  }

  fs.writeFileSync(outPath, Buffer.concat(parts));
}

const origBuf = fs.readFileSync(origSpcPath);
const origInfo = parseSpcInfo(origBuf);

console.log(`Referencia: ${origInfo.length} archivos en orden original`);

// Preservar el ORDEN ORIGINAL
const subfiles = [];
for (const item of origInfo) {
  const filePath = path.join(inputDir, item.filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`  !! Falta: ${item.filename}`);
    continue;
  }
  subfiles.push({
    filename: item.filename,
    data: fs.readFileSync(filePath),
    cmpFlag: item.cmpFlag,
    unkFlag: item.unkFlag
  });
}

console.log(`Empaquetando ${subfiles.length} archivos en el orden original...`);
packSpc(subfiles, outSpc);
console.log(`SPC generado: ${outSpc}`);