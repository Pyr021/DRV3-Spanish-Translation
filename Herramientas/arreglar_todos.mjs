import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const API_KEY = process.env.DEEPSEEK_API_KEY || '';
if (!API_KEY) {
  console.error('Falta la variable de entorno DEEPSEEK_API_KEY.\n  PowerShell: $env:DEEPSEEK_API_KEY="sk-..."');
  process.exit(2);
}
const MODEL = 'deepseek-chat';
const GLOSARIO = fs.readFileSync('C:\\Users\\david\\traductor_v3\\glosario.txt', 'utf-8');
const PERSONAJES = fs.readFileSync('C:\\Users\\david\\traductor_v3\\personajes.txt', 'utf-8');

const ORIG_SPC_DIR = 'C:\\Users\\david\\Desktop\\hgy\\CriPakTools_x64\\partition_data_win_us.cpk_unpacked\\wrd_script\\007';
const MOD_SPC_DIR = 'C:\\Users\\david\\Desktop\\Reloaded2\\Release\\Mods\\CriFs.V2.Hook\\CRIFsV2Hook\\CPK\\partition_data_win_us.cpk\\wrd_script\\007';
const TEMP = 'C:\\Users\\david\\Desktop\\arreglar_temp';
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
    problemas[spc].push({ file: file.replace('.stx', '.txt'), orig: parseInt(orig), trad: parseInt(trad) });
}

async function traducirTrozo(textoTrozo) {
    const instrucciones = `Eres un traductor profesional de videojuegos japoneses al español (España). Traduce los diálogos de Danganronpa V3.

REGLAS OBLIGATORIAS:
1. Traduce al español de España manteniendo el tono original.
2. Usa esta terminología:
${GLOSARIO}
PERSONAJES:
${PERSONAJES}
3. NO modifiques las etiquetas <CLT=...>.
4. Manten EXACTAMENTE el mismo número de bloques "##### NNNN".
5. NO incluyas introducciones, despedidas ni explicaciones.
6. NO uses tildes, NO uses ñ, NO uses ¿ ni ¡.

TEXTO A TRADUCIR:
${textoTrozo}`;

    const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
        body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: instrucciones }], temperature: 0.1 })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].message.content.trim();
}

async function traducirArchivo(origTxtPath, outTxtPath) {
    const textoOriginal = fs.readFileSync(origTxtPath, 'utf-8');
    const bloques = textoOriginal.split(/(?=^##### \d+)/m).filter(b => b.trim() !== '');
    console.log(`    Bloques: ${bloques.length}`);
    
    const TAMANO = 60;
    const trozos = [];
    for (let i = 0; i < bloques.length; i += TAMANO) trozos.push(bloques.slice(i, i + TAMANO));
    
    const resultados = [];
    for (let i = 0; i < trozos.length; i++) {
        const texto = trozos[i].join('');
        const numOrig = (texto.match(/^##### \d+/gm) || []).length;
        let traducido = await traducirTrozo(texto);
        let numTrad = (traducido.match(/^##### \d+/gm) || []).length;
        if (numTrad !== numOrig) {
            console.log(`      Reintentando trozo ${i+1}...`);
            traducido = await traducirTrozo(texto);
            numTrad = (traducido.match(/^##### \d+/gm) || []).length;
        }
        if (numTrad !== numOrig) throw new Error(`Trozo ${i+1} fallo: ${numOrig} vs ${numTrad}`);
        resultados.push(traducido);
        await new Promise(r => setTimeout(r, 1500));
    }
    const final = resultados.join('\n\n');
    const numFinal = (final.match(/^##### \d+/gm) || []).length;
    if (numFinal !== bloques.length) throw new Error(`Total fallo: ${bloques.length} vs ${numFinal}`);
    fs.writeFileSync(outTxtPath, final, 'utf-8');
    console.log(`    OK (${bloques.length} bloques)`);
}

async function main() {
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
        const origTxtDir = path.join(tempDir, 'orig_txt');
        const modTxtDir = path.join(tempDir, 'mod_txt');
        const modStxFixed = path.join(tempDir, 'mod_stx_fixed');
        const modSpcFixed = path.join(tempDir, 'mod_spc_fixed');
        
        fs.mkdirSync(origStxDir, { recursive: true });
        fs.mkdirSync(modStxDir, { recursive: true });
        fs.mkdirSync(origTxtDir, { recursive: true });
        fs.mkdirSync(modTxtDir, { recursive: true });
        fs.mkdirSync(modStxFixed, { recursive: true });
        fs.mkdirSync(modSpcFixed, { recursive: true });

        console.log('  Extrayendo original...');
        run(`node spc_extract.mjs "${origSpc}" "${origStxDir}"`);
        console.log('  Extrayendo mod...');
        run(`node spc_extract.mjs "${modSpc}" "${modStxDir}"`);
        console.log('  Convirtiendo original a .txt...');
        run(`node stx_extract.mjs "${origStxDir}" "${origTxtDir}"`);
        console.log('  Convirtiendo mod a .txt...');
        run(`node stx_extract.mjs "${modStxDir}" "${modTxtDir}"`);

        for (const f of files) {
            console.log(`  Arreglando: ${f.file}`);
            const origTxt = path.join(origTxtDir, f.file);
            const outTxt = path.join(modTxtDir, f.file);
            await traducirArchivo(origTxt, outTxt);
        }

        console.log('  Reempaquetando .txt -> .stx...');
        run(`node stx_repack.mjs "${modTxtDir}" "${modStxFixed}"`);
        console.log('  Reempaquetando .stx -> .spc...');
        const outSpc = path.join(modSpcFixed, spcName);
        run(`node spc_repack.mjs "${modStxFixed}" "${outSpc}"`);
        console.log('  Copiando al mod...');
        fs.copyFileSync(outSpc, modSpc);
        console.log(`  [OK] ${spcName} actualizado`);
    }

    console.log('\n========================================');
    console.log('TODOS LOS ARCHIVOS ARREGLADOS');
    console.log('========================================');
}

main().catch(e => { console.error(e); process.exit(1); });