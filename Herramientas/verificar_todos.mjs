import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MOD_DIR = 'C:\\Users\\david\\Desktop\\Reloaded2\\Release\\Mods\\CriFs.V2.Hook\\CRIFsV2Hook\\CPK\\partition_data_win_us.cpk';
const ORIG_DIR = 'C:\\Users\\david\\Desktop\\hgy\\CriPakTools_x64\\partition_data_win_us.cpk_unpacked';
const TEMP = 'C:\\Users\\david\\Desktop\\verificacion_temp';
const SCRIPTS = 'C:\\Users\\david\\traductor_v3';

function run(cmd) {
    return execSync(cmd, { encoding: 'utf-8', cwd: SCRIPTS });
}

function getStringCount(stxPath) {
    const buf = fs.readFileSync(stxPath);
    if (buf.length < 24) return -1;
    if (buf.toString('ascii', 0, 4) !== 'STXT') return -1;
    return buf.readUInt32LE(20);
}

function walkSpc(dir) {
    const results = [];
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) results.push(...walkSpc(full));
        else if (item.isFile() && item.name.toLowerCase().endsWith('.spc')) results.push(full);
    }
    return results;
}

const modSpcFiles = walkSpc(MOD_DIR);
console.log(`Encontrados ${modSpcFiles.length} .spc en el mod.\n`);

const problemas = [];

for (const modSpc of modSpcFiles) {
    const rel = path.relative(MOD_DIR, modSpc);
    const origSpc = path.join(ORIG_DIR, rel);
    
    if (!fs.existsSync(origSpc)) {
        console.log(`[SKIP] No existe original: ${rel}`);
        continue;
    }
    
    console.log(`Verificando: ${rel}`);
    
    const modStxDir = path.join(TEMP, 'mod', rel.replace(/\.spc$/i, ''));
    const origStxDir = path.join(TEMP, 'orig', rel.replace(/\.spc$/i, ''));
    
    try {
        if (fs.existsSync(modStxDir)) fs.rmSync(modStxDir, { recursive: true, force: true });
        if (fs.existsSync(origStxDir)) fs.rmSync(origStxDir, { recursive: true, force: true });
        fs.mkdirSync(modStxDir, { recursive: true });
        fs.mkdirSync(origStxDir, { recursive: true });
        
        run(`node spc_extract.mjs "${modSpc}" "${modStxDir}"`);
        run(`node spc_extract.mjs "${origSpc}" "${origStxDir}"`);
        
        const modStxFiles = fs.readdirSync(modStxDir).filter(f => f.toLowerCase().endsWith('.stx'));
        let problematicCount = 0;
        
        for (const file of modStxFiles) {
            const modStxPath = path.join(modStxDir, file);
            const origStxPath = path.join(origStxDir, file);
            
            if (!fs.existsSync(origStxPath)) continue;
            
            const modCount = getStringCount(modStxPath);
            const origCount = getStringCount(origStxPath);
            
            if (modCount !== origCount) {
                problemas.push({
                    spc: rel,
                    file: file,
                    orig: origCount,
                    trad: modCount,
                    diff: modCount - origCount
                });
                console.log(`  [PROBLEMA] ${file}: orig=${origCount}, trad=${modCount}, diff=${modCount - origCount}`);
                problematicCount++;
            }
        }
        
        if (problematicCount === 0) {
            console.log(`  OK (${modStxFiles.length} archivos)`);
        }
    } catch (e) {
        console.log(`  ERROR: ${e.message}`);
    }
}

console.log('\n========================================');
console.log(`TOTAL: ${problemas.length} archivos con problemas`);
console.log('========================================');
problemas.forEach(p => console.log(`${p.spc} / ${p.file}: ${p.orig} vs ${p.trad} (diff ${p.diff})`));

const problemsFile = 'C:\\Users\\david\\traductor_v3\\problemas_encontrados.txt';
let content = '';
problemas.forEach(p => { content += `${p.spc}|${p.file}|${p.orig}|${p.trad}\n`; });
fs.writeFileSync(problemsFile, content, 'utf-8');
console.log(`\nProblemas guardados en: ${problemsFile}`);