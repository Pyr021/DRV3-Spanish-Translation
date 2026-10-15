import fs from 'fs';
import path from 'path';

function bitReverse(b) {
    let r = 0;
    for (let i = 0; i < 8; i++) { r = (r << 1) | (b & 1); b >>= 1; }
    return r & 0xFF;
}

function spcDec(buf, decSize) {
    const cmpSize = buf.length;
    if (decSize <= 0) decSize = cmpSize * 2;
    const out = [];
    let flag = 1;
    let pos = 0;
    while (pos < cmpSize) {
        if (flag === 1) flag = 0x100 | bitReverse(buf[pos++]);
        if (pos >= cmpSize) break;
        if (flag & 1) {
            out.push(buf[pos++]);
        } else {
            if (pos + 1 >= cmpSize) break;
            const b = buf.readUInt16LE(pos);
            pos += 2;
            const count = (b >> 10) + 2;
            const offset = b & 1023;
            for (let i = 0; i < count; i++) {
                const idx = out.length - 1024 + offset;
                out.push(out[idx]);
            }
        }
        flag >>= 1;
    }
    return Buffer.from(out);
}

function parseSpc(buf) {
    if (buf.toString('ascii', 0, 4) !== 'CPS.') throw new Error('No es SPC');
    let pos = 4;
    const unk1 = buf.slice(pos, pos + 0x24); pos += 0x24;
    const fileCount = buf.readUInt32LE(pos); pos += 4;
    const unk2 = buf.readUInt32LE(pos); pos += 4;
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
        const data = buf.slice(pos, pos + cmpSize);
        pos += cmpSize + dataPadding;
        subfiles.push({ filename, cmpFlag, unkFlag, cmpSize, decSize, data });
    }
    return { unk1, unk2, subfiles };
}

const [,, spcPath, outDir] = process.argv;
if (!spcPath || !outDir) { console.error('Uso: node spc_extract.mjs <archivo.spc> <carpeta_salida>'); process.exit(1); }

const buf = fs.readFileSync(spcPath);
const spc = parseSpc(buf);
console.log(`SPC con ${spc.subfiles.length} subarchivos`);

let ok = 0, fail = 0;
for (const sf of spc.subfiles) {
    let data;
    if (sf.cmpFlag === 2 && sf.cmpSize < sf.decSize) {
        data = spcDec(sf.data, sf.decSize);
        if (data.length !== sf.decSize) {
            console.warn(`AVISO: ${sf.filename} tamaño ${data.length} != ${sf.decSize}`);
        }
    } else {
        data = sf.data;
    }
    const outPath = path.join(outDir, sf.filename);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, data);
    ok++;
}
console.log(`Listo. ${ok} archivos extraídos a ${outDir}`);