import fs from 'fs';
import path from 'path';

const STX_MAGIC = 'STXT';

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

function repackStxStrings(strings) {
    const tableLen = strings.length;
    const tableOff = 0x20;

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

    const tableBufs = [];
    for (let i = 0; i < tableLen; i++) {
        const entry = Buffer.alloc(8);
        entry.writeUInt32LE(i, 0);
        entry.writeUInt32LE(offsets[i], 4);
        tableBufs.push(entry);
    }

    return Buffer.concat([header, ...tableBufs, ...stringBuffers]);
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

const [,, inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
    console.error('Uso: node stx_repack.mjs <carpeta_txt> <carpeta_stx_salida>');
    process.exit(1);
}

const txtFiles = fs.statSync(inputPath).isDirectory() ? walkTxtFiles(inputPath) : [inputPath];
console.log(`Encontrados ${txtFiles.length} archivos .txt`);

let ok = 0, fail = 0;
for (const txtFile of txtFiles) {
    try {
        const content = fs.readFileSync(txtFile, 'utf-8');
        const strings = parseTxt(content);
        const stxBuf = repackStxStrings(strings);
        const rel = path.relative(inputPath, txtFile);
        const outFile = path.join(outputPath, rel.replace(/\.txt$/i, '.stx'));
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, stxBuf);
        ok++;
    } catch (e) {
        console.error(`ERROR en ${txtFile}: ${e.message}`);
        fail++;
    }
}
console.log(`Listo. ${ok} OK, ${fail} fallos.`);
console.log(`Salida: ${outputPath}`);