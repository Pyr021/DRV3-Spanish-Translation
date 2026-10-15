import fs from 'fs';
import path from 'path';

const STX_MAGIC = 'STXT';

function readStxStrings(filepath) {
    const buf = fs.readFileSync(filepath);
    if (buf.length < 24 || buf.toString('ascii', 0, 4) !== STX_MAGIC) {
        throw new Error('No es un archivo STX válido');
    }
    const tableOff = buf.readUInt32LE(12);
    const tableLen = buf.readUInt32LE(20);
    const strings = [];
    for (let i = 0; i < tableLen; i++) {
        const entryPos = tableOff + i * 8;
        const strOff = buf.readUInt32LE(entryPos + 4);
        let end = strOff;
        while (end + 1 < buf.length && !(buf[end] === 0 && buf[end + 1] === 0)) {
            end += 2;
        }
        strings.push(buf.toString('utf16le', strOff, end));
    }
    return strings;
}

function stringsToTxt(strings) {
    let out = '';
    for (let i = 0; i < strings.length; i++) {
        out += '##### ' + String(i).padStart(4, '0') + '\n';
        out += strings[i] + '\n\n';
    }
    return out;
}

function walkStxFiles(dir) {
    const results = [];
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) results.push(...walkStxFiles(full));
        else if (item.isFile() && item.name.toLowerCase().endsWith('.stx')) results.push(full);
    }
    return results;
}

const [,, inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
    console.error('Uso: node stx_extract.mjs <entrada> <salida>');
    process.exit(1);
}

let stxFiles = fs.statSync(inputPath).isDirectory() ? walkStxFiles(inputPath) : [inputPath];
console.log(`Encontrados ${stxFiles.length} archivos .stx`);

let ok = 0, fail = 0;
for (const stxFile of stxFiles) {
    try {
        const strings = readStxStrings(stxFile);
        const txt = stringsToTxt(strings);
        const rel = path.relative(inputPath, stxFile);
        const outFile = path.join(outputPath, rel.replace(/\.stx$/i, '.txt'));
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, txt, 'utf-8');
        ok++;
    } catch (e) {
        console.error(`ERROR en ${stxFile}: ${e.message}`);
        fail++;
    }
}
console.log(`Listo. ${ok} OK, ${fail} fallos.`);
console.log(`Salida: ${outputPath}`);