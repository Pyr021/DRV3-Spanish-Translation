import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MOD_DIR = 'C:\\Users\\david\\Desktop\\Reloaded2\\Release\\Mods\\CriFs.V2.Hook\\CRIFsV2Hook\\CPK\\partition_data_win_us.cpk\\wrd_script\\007';
const TEMP_DIR = 'C:\\Users\\david\\Desktop\\verif_temp';

function run(cmd) {
    return execSync(cmd, { encoding: 'utf-8', cwd: 'C:\\Users\\david\\traductor_v3' });
}

// Limpiar temp
if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

const spcFiles = fs.readdirSync(MOD_DIR)
    .filter(f => f.toLowerCase().endsWith('.spc'))
    .sort();

console.log('========================================');
console.log('VERIFICACION DE TRADUCCION');
console.log('========================================\n');

for (const spcFile of spcFiles) {
    const name = spcFile.replace(/\.spc$/i, '');
    const stxDir = path.join(TEMP_DIR, name, 'stx');
    const txtDir = path.join(TEMP_DIR, name, 'txt');

    fs.mkdirSync(stxDir, { recursive: true });
    fs.mkdirSync(txtDir, { recursive: true });

    // Extraer .spc -> .stx
    run(`node spc_extract.mjs "${path.join(MOD_DIR, spcFile)}" "${stxDir}"`);

    // Convertir .stx -> .txt
    run(`node stx_extract.mjs "${stxDir}" "${txtDir}"`);

    // Obtener lista de .txt
    const txtFiles = fs.readdirSync(txtDir).filter(f => f.endsWith('.txt')).sort();

    console.log(`========================================`);
    console.log(`ARCHIVO: ${spcFile}`);
    console.log(`Subarchivos: ${txtFiles.length}`);
    console.log(`========================================`);

    // Mostrar los primeros 3 archivos .txt
    for (const txtFile of txtFiles.slice(0, 3)) {
        const content = fs.readFileSync(path.join(txtDir, txtFile), 'utf-8');
        const lines = content.split('\n').slice(0, 5).join('\n');
        console.log(`\n--- ${txtFile} ---`);
        console.log(lines);
    }
    console.log('\n');
}

console.log('========================================');
console.log('FIN DE LA VERIFICACION');
console.log('========================================');