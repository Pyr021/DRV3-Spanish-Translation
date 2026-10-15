import fs from 'fs';
import path from 'path';

const ORIG = 'C:\\Users\\david\\Desktop\\orig_chap1_stx';
const TRAD = 'C:\\Users\\david\\Desktop\\trad_chap1_stx';
const LIMITE = 1000;

const origFiles = fs.readdirSync(ORIG).filter(f => f.endsWith('.stx'));
let reemplazados = 0;

for (const file of origFiles) {
    const origPath = path.join(ORIG, file);
    const tradPath = path.join(TRAD, file);
    if (!fs.existsSync(tradPath)) continue;
    const o = fs.statSync(origPath).size;
    const t = fs.statSync(tradPath).size;
    const diff = t - o;
    if (diff > LIMITE) {
        fs.copyFileSync(origPath, tradPath);
        console.log(`[REEMPLAZADO] ${file}: orig=${o}, trad=${t}, diff=${diff}`);
        reemplazados++;
    }
}

console.log(`\nTotal reemplazados: ${reemplazados}`);