import fs from 'fs';
import path from 'path';

const ORIG = 'C:\\Users\\david\\Desktop\\test_reempaquetado';
const TRAD = 'C:\\Users\\david\\Desktop\\trad_chap1_stx';

const origFiles = fs.readdirSync(ORIG).filter(f => f.endsWith('.stx')).sort();
let sospechosos = [];

for (const file of origFiles) {
    const origPath = path.join(ORIG, file);
    const tradPath = path.join(TRAD, file);
    if (!fs.existsSync(tradPath)) continue;

    const origBuf = fs.readFileSync(origPath);
    const tradBuf = fs.readFileSync(tradPath);

    // Extraer strings UTF-16LE de ambos (aproximación: buscar texto legible)
    function extractStrings(buf) {
        const strs = [];
        for (let i = 0; i < buf.length - 1; i += 2) {
            const code = buf.readUInt16LE(i);
            if (code >= 32 && code <= 126) {
                let s = '';
                let j = i;
                while (j < buf.length - 1) {
                    const c = buf.readUInt16LE(j);
                    if (c >= 32 && c <= 126) { s += String.fromCharCode(c); j += 2; }
                    else break;
                }
                if (s.length > 2) { strs.push(s); i = j - 2; }
            }
        }
        return strs;
    }

    const origStrs = extractStrings(origBuf);
    const tradStrs = extractStrings(tradBuf);

    // Buscar caracteres raros en el traducido (no ASCII imprimible ni saltos de línea)
    // y también diferencias en el número de strings
    const texto = tradBuf.toString('utf16le');
    const charsRaros = texto.match(/[^\x20-\x7E\n\r\táéíóúÁÉÍÓÚñÑ¿¡üÜ]/g);
    if (charsRaros) {
        const unicos = [...new Set(charsRaros)];
        sospechosos.push(`${file}: caracteres raros -> ${JSON.stringify(unicos)}`);
    }

    // Comparar número de strings (aproximado)
    if (Math.abs(origStrs.length - tradStrs.length) > 2) {
        sospechosos.push(`${file}: orig strings=${origStrs.length}, trad strings=${tradStrs.length}`);
    }
}

console.log('=== ARCHIVOS SOSPECHOSOS ===');
if (sospechosos.length === 0) {
    console.log('Ninguno. Todos los archivos parecen limpios.');
} else {
    sospechosos.forEach(s => console.log(s));
}
console.log(`\nTotal archivos analizados: ${origFiles.length}`);
console.log(`Total sospechosos: ${sospechosos.length}`);