import fs from 'fs';
import path from 'path';

function countMarkers(content) {
    const markers = content.match(/^##### \d+/gm) || [];
    const tags = content.match(/<CLT=[^>]+>/g) || [];
    return { markers: markers.length, tags: tags.length };
}

const [,, origDir, tradDir] = process.argv;
if (!origDir || !tradDir) { console.error('Uso: node verificar.mjs <dir_original> <dir_traducido>'); process.exit(1); }

let ok = 0, fail = 0;
for (const file of fs.readdirSync(origDir).filter(f => f.endsWith('.txt'))) {
    const origPath = path.join(origDir, file);
    const tradPath = path.join(tradDir, file);
    if (!fs.existsSync(tradPath)) { console.log(`FALTA ${file}`); fail++; continue; }
    const orig = fs.readFileSync(origPath, 'utf-8');
    const trad = fs.readFileSync(tradPath, 'utf-8');
    const o = countMarkers(orig);
    const t = countMarkers(trad);
    if (o.markers === t.markers && o.tags === t.tags) {
        ok++;
    } else {
        console.log(`FAIL ${file}: original=${JSON.stringify(o)} traducido=${JSON.stringify(t)}`);
        fail++;
    }
}
console.log(`\nTotal: ${ok} OK, ${fail} FAIL`);