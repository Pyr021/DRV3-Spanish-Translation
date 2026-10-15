import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ORIG_SPC_DIR = 'C:\\Users\\david\\Desktop\\hgy\\CriPakTools_x64\\partition_data_win_us.cpk_unpacked\\wrd_script\\007';
const MOD_SPC_DIR = 'C:\\Users\\david\\Desktop\\Reloaded2\\Release\\Mods\\CriFs.V2.Hook\\CRIFsV2Hook\\CPK\\partition_data_win_us.cpk\\wrd_script\\007';
const TEMP = 'C:\\Users\\david\\Desktop\\arreglo2_temp';
const SCRIPTS = 'C:\\Users\\david\\traductor_v3';

function run(cmd, cwd) {
    execSync(cmd, { stdio: 'inherit', cwd: cwd || SCRIPTS });
}

// Leer problemas
const problemasTxt = fs.readFileSync(path.join(SCRIPTS, 'problemas_encontrados.txt'), 'utf-8');
const lineas = problemasTxt.split('\n').filter(l => l.trim() !== '');
const problemas = {};
for (const linea of lineas) {
    const [spc, file, orig, trad] = linea.split('|');
    if (!problemas[spc]) problemas[spc] = [];
    problemas[spc].push(file);
}

if (fs.existsSync(TEMP)) fs.rmSync(TEMP, { recursive: true, force: true });
fs.mkdirSync(TEMP, { recursive: true });

for (const [spcRel, files] of Object.entries(problemas)) {
    const spcName = path.basename(spcRel);
    console.log(`\n=== ${spcName} ===`);
    
    const origSpc = path.join(ORIG_SPC_DIR, spcName);
    const modSpc = path.join(MOD_SPC_DIR, spcName);
    const tempDir = path.join(TEMP, spcName.replace('.SPC', ''));
    const origStxDir = path.join(tempDir, 'orig_stx');
    const modStxDir = path.join(tempDir, 'mod_stx');
    const fixedStxDir = path.join(tempDir, 'fixed_stx');
    const fixedSpcDir = path.join(tempDir, 'fixed_spc');
    
    fs.mkdirSync(origStxDir, { recursive: true });
    fs.mkdirSync(modStxDir, { recursive: true });
    fs.mkdirSync(fixedStxDir, { recursive: true });
    fs.mkdirSync(fixedSpcDir, { recursive: true });

    console.log('  Extrayendo original...');
    run(`node spc_extract.mjs "${origSpc}" "${origStxDir}"`);
    console.log('  Extrayendo mod...');
    run(`node spc_extract.mjs "${modSpc}" "${modStxDir}"`);

    // Copiar todos los .stx del mod a fixed_stx
    const modFiles = fs.readdirSync(modStxDir).filter(f => f.endsWith('.stx'));
    for (const f of modFiles) {
        fs.copyFileSync(path.join(modStxDir, f), path.join(fixedStxDir, f));
    }

    // Sobrescribir los problemáticos con el original
    for (const f of files) {
        console.log(`  Reemplazando con original: ${f}`);
        fs.copyFileSync(path.join(origStxDir, f), path.join(fixedStxDir, f));
    }

    console.log('  Reempaquetando .stx -> .spc...');
    const outSpc = path.join(fixedSpcDir, spcName);
    run(`node spc_repack.mjs "${fixedStxDir}" "${outSpc}"`);
    console.log('  Copiando al mod...');
    fs.copyFileSync(outSpc, modSpc);
    console.log(`  [OK] ${spcName} actualizado`);
}

console.log('\n========================================');
console.log('ARCHIVOS PROBLEMATICOS REEMPLAZADOS CON ORIGINALES');
console.log('========================================');