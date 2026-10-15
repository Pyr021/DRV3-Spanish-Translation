import fs from 'fs';
import path from 'path';
import { spcCmp } from './spc_cmp.mjs';

function packSpc(subfiles, outPath) {
    const parts = [];

    // Magic "CPS."
    parts.push(Buffer.from('CPS.', 'ascii'));

    // unk1: 0x24 bytes, con FF FF FF FF FF FF FF FF en las posiciones 4-11
    const unk1 = Buffer.alloc(0x24, 0);
    unk1[4] = 0xFF; unk1[5] = 0xFF; unk1[6] = 0xFF; unk1[7] = 0xFF;
    unk1[8] = 0xFF; unk1[9] = 0xFF; unk1[10] = 0xFF; unk1[11] = 0xFF;
    parts.push(unk1);

    // file_count
    const fileCountBuf = Buffer.alloc(4);
    fileCountBuf.writeUInt32LE(subfiles.length);
    parts.push(fileCountBuf);

    // unk2 = 4
    const unk2Buf = Buffer.alloc(4);
    unk2Buf.writeUInt32LE(4);
    parts.push(unk2Buf);

    // padding 0x10
    parts.push(Buffer.alloc(0x10, 0));

    // "Root"
    parts.push(Buffer.from('Root', 'ascii'));

    // padding 0x0C
    parts.push(Buffer.alloc(0x0C, 0));

    // Subarchivos
    for (const sf of subfiles) {
        const compressed = spcCmp(sf.data);
        const nameBuf = Buffer.from(sf.filename, 'utf-8');
        const namePadding = (0x10 - (nameBuf.length + 1) % 0x10) % 0x10;
        const dataPadding = (0x10 - compressed.length % 0x10) % 0x10;

        const header = Buffer.alloc(0x20);
        header.writeUInt16LE(2, 0);                       // cmp_flag = 2 (comprimido)
        header.writeUInt16LE(4, 2);                       // unk_flag = 4 (como el original)
        header.writeUInt32LE(compressed.length, 4);       // cmp_size
        header.writeUInt32LE(sf.data.length, 8);          // dec_size
        header.writeUInt32LE(nameBuf.length, 12);         // name_len
        parts.push(header);
        parts.push(nameBuf);
        parts.push(Buffer.alloc(namePadding + 1, 0));     // nombre + null + padding
        parts.push(compressed);
        parts.push(Buffer.alloc(dataPadding, 0));         // padding de datos

        const ratio = ((1 - compressed.length / sf.data.length) * 100).toFixed(1);
        console.log(`  ${sf.filename}: ${sf.data.length} → ${compressed.length} bytes (${ratio}%)`);
    }

    fs.writeFileSync(outPath, Buffer.concat(parts));
}

const [,, inputDir, outSpc] = process.argv;
if (!inputDir || !outSpc) {
    console.error('Uso: node spc_repack_generic.mjs <carpeta_archivos> <archivo_spc_salida>');
    process.exit(1);
}

// Aceptar TODOS los archivos, no solo .stx
const files = fs.readdirSync(inputDir).filter(f => {
    const full = path.join(inputDir, f);
    return fs.statSync(full).isFile();
}).sort();

console.log(`Empaquetando ${files.length} archivos con compresión LZ...`);

const subfiles = files.map(f => ({
    filename: f,
    data: fs.readFileSync(path.join(inputDir, f))
}));

packSpc(subfiles, outSpc);
console.log(`SPC generado: ${outSpc}`);