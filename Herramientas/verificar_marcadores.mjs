import fs from 'fs';
import path from 'path';

const ORIG = 'C:\\Users\\david\\Desktop\\test_reempaquetado';
const TRAD = 'C:\\Users\\david\\Desktop\\trad_chap1_txt';

function contarMarcadores(txtFile) {
    const content = fs.readFileSync(txtFile, 'utf-8');
    const matches = content.match(/^##### \d+/gm);
    return matches ? matches.length : 0;
}

const origTxtDir = ORIG; // Asumimos que ya tienes los .txt originales
// Pero ORIG tiene .stx. Necesitamos los .txt. Vamos a usar orig_chap1_txt.

const ORIG_TXT = 'C:\\Users\\david\\Desktop\\game_resident_txt';
const TRAD_TXT = 'C:\\Users\\david\\Desktop\\game_resident_trad';

const origFiles = fs.readdirSync(ORIG_TXT).filter(f => f.endsWith('.txt')).sort();
let problemas = [];

for (const file of origFiles) {
    const origCount = contarMarcadores(path.join(ORIG_TXT, file));
    const tradPath = path.join(TRAD_TXT, file);
    if (!fs.existsSync(tradPath)) continue;
    const tradCount = contarMarcadores(tradPath);
    
    if (origCount !== tradCount) {
        problemas.push(`${file}: orig=${origCount}, trad=${tradCount}, diff=${tradCount - origCount}`);
    }
}

console.log('=== ARCHIVOS CON DIFERENTE NUMERO DE MARCADORES ===');
problemas.forEach(p => console.log(p));
console.log(`\nTotal archivos con problemas: ${problemas.length}`);