import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SCRIPT_DIR = 'C:\\Users\\david\\traductor_v3';
const GLOSARIO = path.join(SCRIPT_DIR, 'glosario.txt');
const TEMP = 'C:\\Users\\david\\Desktop\\pipeline_temp';

const [, , spcDir, modDir] = process.argv;
if (!spcDir || !modDir) {
    console.error('Uso: node pipeline.mjs <carpeta_spc_originales> <carpeta_mod_destino>');
    process.exit(1);
}

function run(cmd, cwd) {
    console.log(`\n> ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: cwd || SCRIPT_DIR });
}

// Filtrar solo los archivos de texto
const spcFiles = fs.readdirSync(spcDir)
    .filter(f => f.toLowerCase().endsWith('.spc'))
    .filter(f => f.toLowerCase().includes('_text_'))
    .sort();

console.log(`Encontrados ${spcFiles.length} archivos .spc de texto.`);

let ok = 0, fail = 0;

for (const spcFile of spcFiles) {
    const name = spcFile.replace(/\.spc$/i, '');
    const modFile = path.join(modDir, spcFile);

    console.log(`\n========================================`);
    console.log(`=== Procesando: ${spcFile}`);
    console.log(`========================================`);

    if (fs.existsSync(modFile)) {
        console.log(`[SKIP] Ya existe en el mod: ${modFile}`);
        ok++;
        continue;
    }

    try {
        const tempSpc = path.join(TEMP, name);
        const stxDir = path.join(tempSpc, 'stx');
        const txtDir = path.join(tempSpc, 'txt');
        const txtTradDir = path.join(tempSpc, 'txt_traducido');
        const stxTradDir = path.join(tempSpc, 'stx_traducido');
        const spcTradDir = path.join(tempSpc, 'spc_traducido');

        // Limpiar temp
        if (fs.existsSync(tempSpc)) fs.rmSync(tempSpc, { recursive: true, force: true });
        fs.mkdirSync(stxDir, { recursive: true });
        fs.mkdirSync(txtDir, { recursive: true });
        fs.mkdirSync(txtTradDir, { recursive: true });
        fs.mkdirSync(stxTradDir, { recursive: true });
        fs.mkdirSync(spcTradDir, { recursive: true });

        // 1. Extraer .spc → .stx
        run(`node spc_extract.mjs "${path.join(spcDir, spcFile)}" "${stxDir}"`);

        // 2. Convertir .stx → .txt
        run(`node stx_extract.mjs "${stxDir}" "${txtDir}"`);

        // 3. Traducir
        run(`node traductor_stx.mjs "${txtDir}" "${txtTradDir}" "${GLOSARIO}"`);

        // 4. Reempaquetar .txt → .stx
        run(`node stx_repack.mjs "${txtTradDir}" "${stxTradDir}"`);

        // 5. Reempaquetar .stx → .spc
        const spcOutput = path.join(spcTradDir, spcFile);
        run(`node spc_repack.mjs "${stxTradDir}" "${spcOutput}"`);

        // 6. Copiar al mod
        fs.mkdirSync(modDir, { recursive: true });
        fs.copyFileSync(spcOutput, modFile);
        console.log(`\n[OK] ${spcFile} copiado al mod`);

        ok++;
    } catch (e) {
        console.error(`\n[ERROR] Fallo en ${spcFile}: ${e.message}`);
        fail++;
    }
}

console.log(`\n========================================`);
console.log(`Resumen: ${ok} OK, ${fail} fallos`);
console.log(`========================================`);