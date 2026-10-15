import fs from 'fs';

const [, , spcPath] = process.argv;
if (!spcPath) { console.error('Uso: node spc_info.mjs <archivo.spc>'); process.exit(1); }

const buf = fs.readFileSync(spcPath);
const magic = buf.toString('ascii', 0, 4);
console.log('Magic:', magic);
if (magic !== 'CPS.') { console.error('No es un SPC válido'); process.exit(1); }

let pos = 4 + 0x24;
const fileCount = buf.readUInt32LE(pos); pos += 4;
const unk2 = buf.readUInt32LE(pos); pos += 4;
pos += 0x10;
const tableMagic = buf.toString('ascii', pos, pos + 4); pos += 4;
pos += 0x0C;

console.log('File count:', fileCount);
console.log('unk2:', unk2);
console.log('Table magic:', tableMagic);
console.log('---');

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

    console.log(`[${i}] ${filename}`);
    console.log(`    cmpFlag=${cmpFlag} unkFlag=${unkFlag} cmpSize=${cmpSize} decSize=${decSize}`);
}