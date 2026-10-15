import fs from 'fs';
import path from 'path';

const API_KEY = process.env.DEEPSEEK_API_KEY || '';
if (!API_KEY) {
  console.error('Falta la variable de entorno DEEPSEEK_API_KEY.\n  PowerShell: $env:DEEPSEEK_API_KEY="sk-..."');
  process.exit(2);
}
const MODEL = 'deepseek-chat';
const GLOSARIO = fs.readFileSync('C:\\Users\\david\\traductor_v3\\glosario.txt', 'utf-8');
const PERSONAJES = fs.readFileSync('C:\\Users\\david\\traductor_v3\\personajes.txt', 'utf-8');

const INPUT_DIR = 'C:\\Users\\david\\Desktop\\rsc_text_package';
const OUTPUT_DIR = 'C:\\Users\\david\\Desktop\\rsc_text_package_trad';

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BATCH_SIZE = 40;

async function traducirBatch(textos) {
    const lista = textos.map((t, i) => `[${i}] ${t}`).join('\n');
    
    const instrucciones = `Eres un traductor profesional de videojuegos japoneses al español (España). Traduce los siguientes textos de Danganronpa V3.

REGLAS:
1. Traduce al español de España.
2. Usa esta terminología:
${GLOSARIO}
PERSONAJES:
${PERSONAJES}
3. USA tildes correctamente (a, e, i, o, u con acento cuando corresponda).
4. USA la letra ñ cuando corresponda.
5. USA los signos de apertura ¿ y ¡ correctamente.
6. Mantén los saltos de linea \\n exactamente igual.
7. Devuelve UNICAMENTE las lineas traducidas con su numero entre corchetes, en el mismo orden. Sin explicaciones.

TEXTOS:
${lista}`;

    const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
        body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: instrucciones }], temperature: 0.1 })
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const respuesta = data.choices[0].message.content.trim();
    
    // Parsear la respuesta
    const lineas = respuesta.split('\n');
    const traducciones = {};
    for (const linea of lineas) {
        const match = linea.match(/^\[(\d+)\]\s*(.*)$/);
        if (match) {
            traducciones[parseInt(match[1])] = match[2];
        }
    }
    
    return textos.map((_, i) => traducciones[i] || textos[i]);
}

async function traducirArchivo(jsonPath, outputPath) {
    const contenido = fs.readFileSync(jsonPath, 'utf-8');
    const datos = JSON.parse(contenido);
    
    console.log(`  ${path.basename(jsonPath)}: ${datos.length} entradas`);
    
    const textos = datos.map(d => d.Text);
    const traducciones = [];
    
    for (let i = 0; i < textos.length; i += BATCH_SIZE) {
        const batch = textos.slice(i, i + BATCH_SIZE);
        console.log(`    Batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(textos.length/BATCH_SIZE)}...`);
        const trad = await traducirBatch(batch);
        traducciones.push(...trad);
        await new Promise(r => setTimeout(r, 1000));
    }
    
    // Reconstruir el JSON
    const resultado = datos.map((d, i) => ({
        Id: d.Id,
        Unknown1: d.Unknown1,
        Unknown2: d.Unknown2,
        Text: traducciones[i]
    }));
    
    fs.writeFileSync(outputPath, JSON.stringify(resultado, null, 2), 'utf-8');
    console.log(`  OK guardado en ${outputPath}`);
}

async function main() {
    const jsonFiles = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.rsct.json')).sort();
    console.log(`Encontrados ${jsonFiles.length} archivos .rsct.json\n`);
    
    for (const f of jsonFiles) {
        console.log(`\n=== ${f} ===`);
        try {
            await traducirArchivo(path.join(INPUT_DIR, f), path.join(OUTPUT_DIR, f));
        } catch (e) {
            console.error(`  ERROR: ${e.message}`);
        }
    }
    
    console.log('\n========================================');
    console.log('TRADUCCION COMPLETA');
    console.log('========================================');
}

main().catch(e => { console.error(e); process.exit(1); });