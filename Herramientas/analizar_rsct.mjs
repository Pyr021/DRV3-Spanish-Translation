import fs from 'fs';
import path from 'path';

const ORIG = 'C:\\Users\\david\\Desktop\\rsc_text_package';
const TRAD = 'C:\\Users\\david\\Desktop\\rsc_text_package_trad';

function analizar(nombre) {
    const orig = JSON.parse(fs.readFileSync(path.join(ORIG, nombre), 'utf-8'));
    const trad = JSON.parse(fs.readFileSync(path.join(TRAD, nombre), 'utf-8'));
    
    console.log(`\n=== ${nombre} ===`);
    
    let vacios = 0, saltosPerdidos = 0;
    for (let i = 0; i < orig.length; i++) {
        const o = orig[i];
        const t = trad[i];
        
        if (!t.Text || t.Text.trim() === '') {
            console.log(`  VACIO id=${o.Id}: original="${o.Text}"`);
            vacios++;
        }
        
        const oSaltos = (o.Text.match(/\\n/g) || []).length;
        const tSaltos = (t.Text.match(/\\n/g) || []).length;
        if (oSaltos !== tSaltos) {
            if (saltosPerdidos < 10) {
                console.log(`  SALTOS id=${o.Id}: orig(${oSaltos})="${o.Text.substring(0, 60)}" | trad(${tSaltos})="${t.Text.substring(0, 60)}"`);
            }
            saltosPerdidos++;
        }
    }
    console.log(`  Total vacios: ${vacios}, saltos perdidos: ${saltosPerdidos}`);
}

analizar('CommonText.rsct.json');
analizar('RscText_season.rsct.json');