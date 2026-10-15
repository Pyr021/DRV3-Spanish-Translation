import fs from 'fs';
import path from 'path';

const ORIG_DIR = 'C:\\Users\\david\\Desktop\\rsc_text_package';
const TRAD_DIR = 'C:\\Users\\david\\Desktop\\rsc_text_package_trad';

const jsonFiles = fs.readdirSync(ORIG_DIR).filter(f => f.endsWith('.rsct.json')).sort();
console.log(`Verificando ${jsonFiles.length} archivos...\n`);

let ok = 0;
let fail = 0;
const problemas = [];

for (const f of jsonFiles) {
    const origPath = path.join(ORIG_DIR, f);
    const tradPath = path.join(TRAD_DIR, f);
    
    console.log(`=== ${f} ===`);
    
    if (!fs.existsSync(tradPath)) {
        console.log(`  [FALTA] No existe el traducido`);
        problemas.push(`${f}: archivo traducido no existe`);
        fail++;
        continue;
    }
    
    try {
        const orig = JSON.parse(fs.readFileSync(origPath, 'utf-8'));
        const trad = JSON.parse(fs.readFileSync(tradPath, 'utf-8'));
        
        let problemasArchivo = [];
        
        // 1. Mismo numero de entradas
        if (orig.length !== trad.length) {
            problemasArchivo.push(`Numero de entradas: orig=${orig.length}, trad=${trad.length}`);
        }
        
        const len = Math.min(orig.length, trad.length);
        let camposIdDiferentes = 0;
        let camposUnknownDiferentes = 0;
        let textosVacios = 0;
        let textosConAcentos = 0;
        let saltosLineaPerdidos = 0;
        let textosSinTraducir = 0;
        
        for (let i = 0; i < len; i++) {
            const o = orig[i];
            const t = trad[i];
            
            // 2. Id igual
            if (o.Id !== t.Id) camposIdDiferentes++;
            
            // 3. Unknown1 y Unknown2 iguales
            if (o.Unknown1 !== t.Unknown1 || o.Unknown2 !== t.Unknown2) camposUnknownDiferentes++;
            
            // 4. Texto no vacio
            if (!t.Text || t.Text.trim() === '') textosVacios++;
            
            // 5. Sin acentos prohibidos
            if (/[áéíóúÁÉÍÓÚñÑ¿¡]/.test(t.Text)) textosConAcentos++;
            
            // 6. Saltos de linea preservados
            const oSaltos = (o.Text.match(/\\n/g) || []).length;
            const tSaltos = (t.Text.match(/\\n/g) || []).length;
            if (oSaltos !== tSaltos) saltosLineaPerdidos++;
            
            // 7. El texto cambio (fue traducido)
            if (o.Text === t.Text && /^[a-zA-Z\s\n'!?.,:;()\-]+$/.test(o.Text)) textosSinTraducir++;
        }
        
        if (camposIdDiferentes > 0) problemasArchivo.push(`${camposIdDiferentes} entradas con Id diferente`);
        if (camposUnknownDiferentes > 0) problemasArchivo.push(`${camposUnknownDiferentes} entradas con Unknown1/Unknown2 diferentes`);
        if (textosVacios > 0) problemasArchivo.push(`${textosVacios} entradas con texto vacio`);
        if (textosConAcentos > 0) problemasArchivo.push(`${textosConAcentos} entradas con acentos prohibidos`);
        if (saltosLineaPerdidos > 0) problemasArchivo.push(`${saltosLineaPerdidos} entradas con saltos de linea perdidos`);
        if (textosSinTraducir > 10) problemasArchivo.push(`AVISO: ${textosSinTraducir} entradas parecen no traducidas`);
        
        if (problemasArchivo.length === 0) {
            console.log(`  OK (${orig.length} entradas)`);
            ok++;
        } else {
            console.log(`  PROBLEMAS:`);
            problemasArchivo.forEach(p => console.log(`    - ${p}`));
            problemas.push(`${f}: ${problemasArchivo.join('; ')}`);
            fail++;
        }
    } catch (e) {
        console.log(`  ERROR al parsear: ${e.message}`);
        problemas.push(`${f}: ${e.message}`);
        fail++;
    }
}

console.log('\n========================================');
console.log(`RESUMEN: ${ok} OK, ${fail} con problemas`);
console.log('========================================');

if (problemas.length > 0) {
    console.log('\nDetalle de problemas:');
    problemas.forEach(p => console.log(`  ${p}`));
    
    const problemsFile = 'C:\\Users\\david\\traductor_v3\\problemas_rsct.txt';
    fs.writeFileSync(problemsFile, problemas.join('\n'), 'utf-8');
    console.log(`\nGuardado en: ${problemsFile}`);
}