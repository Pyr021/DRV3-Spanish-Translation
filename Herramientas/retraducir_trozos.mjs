import fs from 'fs';

const API_KEY = process.env.DEEPSEEK_API_KEY || '';
if (!API_KEY) {
  console.error('Falta la variable de entorno DEEPSEEK_API_KEY.\n  PowerShell: $env:DEEPSEEK_API_KEY="sk-..."');
  process.exit(2);
}
const MODEL = 'deepseek-chat';
const INPUT = 'C:\\Users\\david\\Desktop\\orig_chap1_txt\\c01_100_019.txt';
const OUTPUT_DIR = 'C:\\Users\\david\\Desktop\\retraduccion';
const OUTPUT = OUTPUT_DIR + '\\c01_100_019.txt';
const GLOSARIO_PATH = 'C:\\Users\\david\\traductor_v3\\glosario.txt';
const PERSONAJES_PATH = 'C:\\Users\\david\\traductor_v3\\personajes.txt';

const glosario = fs.readFileSync(GLOSARIO_PATH, 'utf-8');
const personajes = fs.readFileSync(PERSONAJES_PATH, 'utf-8');
const textoOriginal = fs.readFileSync(INPUT, 'utf-8');

// Separar por bloques "##### NNNN"
const bloques = textoOriginal.split(/(?=^##### \d+)/m).filter(b => b.trim() !== '');
console.log(`Total bloques: ${bloques.length}`);

// Dividir en trozos de 60 bloques
const TAMANO_TROZO = 60;
const trozos = [];
for (let i = 0; i < bloques.length; i += TAMANO_TROZO) {
    trozos.push(bloques.slice(i, i + TAMANO_TROZO));
}
console.log(`Dividido en ${trozos.length} trozos.`);

async function traducirTrozo(textoTrozo, numTrozo, totalTrozos) {
    const instrucciones = `Eres un traductor profesional de videojuegos japoneses al español (España). Traduce los diálogos de Danganronpa V3 que te paso a continuación.

REGLAS OBLIGATORIAS:
1. Traduce al español de España manteniendo el tono original.
2. Usa esta terminología:
${glosario}

PERSONAJES:
${personajes}

3. NO modifiques las etiquetas <CLT=...>. Deben quedar exactamente igual.
4. Manten EXACTAMENTE el mismo número de bloques "##### NNNN" que el original.
5. NO incluyas introducciones, despedidas ni explicaciones.
6. NO uses tildes, NO uses ñ, NO uses ¿ ni ¡.

TEXTO A TRADUCIR:
${textoTrozo}`;

    const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: instrucciones }],
            temperature: 0.1
        })
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
    }

    const data = await res.json();
    let traducido = data.choices[0].message.content.trim();
    return traducido;
}

async function main() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    const resultados = [];
    
    for (let i = 0; i < trozos.length; i++) {
        const texto = trozos[i].join('');
        const numBloquesOrig = (texto.match(/^##### \d+/gm) || []).length;
        console.log(`\n--- Trozo ${i+1}/${trozos.length} (${numBloquesOrig} bloques) ---`);
        
        let traducido = await traducirTrozo(texto, i+1, trozos.length);
        let numBloquesTrad = (traducido.match(/^##### \d+/gm) || []).length;
        
        console.log(`Original: ${numBloquesOrig} bloques, Traducido: ${numBloquesTrad} bloques`);
        
        // Si falla, reintentar una vez
        if (numBloquesTrad !== numBloquesOrig) {
            console.log('Reintentando con instrucciones mas estrictas...');
            traducido = await traducirTrozo(texto, i+1, trozos.length);
            numBloquesTrad = (traducido.match(/^##### \d+/gm) || []).length;
            console.log(`Reintento: ${numBloquesTrad} bloques`);
        }
        
        if (numBloquesTrad !== numBloquesOrig) {
            console.error(`!! ERROR en trozo ${i+1}: ${numBloquesOrig} vs ${numBloquesTrad}. Abortando.`);
            fs.writeFileSync(`${OUTPUT_DIR}\\trozo_${i+1}_FALLO.txt`, traducido, 'utf-8');
            process.exit(1);
        }
        
        resultados.push(traducido);
        await new Promise(r => setTimeout(r, 1500));
    }
    
    const resultadoFinal = resultados.join('\n\n');
    const numBloquesFinal = (resultadoFinal.match(/^##### \d+/gm) || []).length;
    console.log(`\nTotal bloques en el resultado final: ${numBloquesFinal}`);
    
    if (numBloquesFinal !== bloques.length) {
        console.error(`!! ERROR: ${bloques.length} bloques originales vs ${numBloquesFinal} traducidos. NO guardado.`);
        fs.writeFileSync(`${OUTPUT_DIR}\\c01_100_019_FALLO.txt`, resultadoFinal, 'utf-8');
        process.exit(1);
    }
    
    fs.writeFileSync(OUTPUT, resultadoFinal, 'utf-8');
    console.log(`\n¡EXITO! Guardado en ${OUTPUT}`);
}

main().catch(e => console.error(e));