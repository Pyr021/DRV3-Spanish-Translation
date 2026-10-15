import fs from 'fs';
import path from 'path';

const ORIG = 'C:\\Users\\david\\Desktop\\rsc_text_package';
const TRAD = 'C:\\Users\\david\\Desktop\\rsc_text_package_trad';

const jsonFiles = fs.readdirSync(TRAD).filter(f => f.endsWith('.rsct.json')).sort();

let arregladosSaltos = 0;
let arregladosVacios = 0;

for (const f of jsonFiles) {
    const orig = JSON.parse(fs.readFileSync(path.join(ORIG, f), 'utf-8'));
    const trad = JSON.parse(fs.readFileSync(path.join(TRAD, f), 'utf-8'));
    
    for (let i = 0; i < orig.length; i++) {
        const o = orig[i];
        const t = trad[i];
        
        const oLit = (o.Text.match(/\\n/g) || []).length;
        const tLit = (t.Text.match(/\\n/g) || []).length;
        
        // Si el trad tiene MAS \n literales que el original, convertir los extra
        if (tLit > oLit) {
            let nuevo = t.Text;
            let aConvertir = tLit - oLit;
            while (aConvertir > 0) {
                nuevo = nuevo.replace('\\n', '\n');
                aConvertir--;
            }
            t.Text = nuevo;
            arregladosSaltos++;
        }
        
        // Si el original tiene texto pero el trad esta vacio
        if (o.Text.trim() !== '' && (!t.Text || t.Text.trim() === '')) {
            t.Text = o.Text;
            arregladosVacios++;
        }
    }
    
    fs.writeFileSync(path.join(TRAD, f), JSON.stringify(trad, null, 2), 'utf-8');
    console.log(`Arreglado: ${f}`);
}

console.log(`\nTotal saltos arreglados: ${arregladosSaltos}`);
console.log(`Total textos vacios restaurados: ${arregladosVacios}`);