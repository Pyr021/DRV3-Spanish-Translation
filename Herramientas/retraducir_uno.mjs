import fs from 'fs';

const API_KEY = process.env.DEEPSEEK_API_KEY || '';
if (!API_KEY) {
  console.error('Falta la variable de entorno DEEPSEEK_API_KEY.\n  PowerShell: $env:DEEPSEEK_API_KEY="sk-..."');
  process.exit(2);
}
const MODEL = 'deepseek-chat';

const INPUT = 'C:\\Users\\david\\Desktop\\orig_chap1_txt\\c01_100_019.txt';
const OUTPUT = 'C:\\Users\\david\\Desktop\\retraduccion\\c01_100_019.txt';
const GLOSARIO = 'C:\\Users\\david\\traductor_v3\\glosario.txt';
const PERSONAJES = 'C:\\Users\\david\\traductor_v3\\personajes.txt';

const glosario = fs.readFileSync(GLOSARIO, 'utf-8');
const personajes = fs.readFileSync(PERSONAJES, 'utf-8');
const textoOriginal = fs.readFileSync(INPUT, 'utf-8');

// Contar marcadores originales
const marcadoresOrig = (textoOriginal.match(/^##### \d+/gm) || []).length;
console.log(`Marcadores en el original: ${marcadoresOrig}`);

const instrucciones = `Eres un traductor profesional de videojuegos japoneses al español (España). Vas a traducir diálogos de Danganronpa V3.

REGLA ABSOLUTA Y CRITICA:
- El texto original tiene EXACTAMENTE ${marcadoresOrig} marcadores "##### NNNN".
- Tu traducción DEBE tener EXACTAMENTE ${marcadoresOrig} marcadores "##### NNNN".
- Si te falta uno solo, el juego crashea. Es un requisito tecnico, no estilistico.
- NO juntes lineas. NO dividas lineas. NO omitas contenido. Cada "##### NNNN" del original DEBE tener su correspondiente "##### NNNN" en la traduccion.
- Los numeros deben ser SECUENCIALES y EXACTOS: 0000, 0001, 0002, etc.

REGLAS OBLIGATORIAS:
1. Traduce al español de España manteniendo el tono original.
2. Usa esta terminología:
${glosario}

PERSONAJES:
${personajes}

3. NUNCA modifiques las etiquetas <CLT=...>. Deben quedar exactamente igual.
4. NUNCA modifiques los marcadores "##### NNNN".
5. NO incluyas introducciones, despedidas ni explicaciones. Solo el texto traducido.
6. Respeta los saltos de linea internos de cada bloque.

REGLAS DE CARACTERES:
- NUNCA uses tildes (a, e, i, o, u sin acento).
- NUNCA uses la letra ñ. Escribe "n" en su lugar.
- NUNCA uses ¿ ni ¡. Solo los signos de cierre.

FORMATO DE ENTRADA:
##### 0000
Texto original

##### 0001
Otro texto

FORMATO DE SALIDA (identico pero traducido):
##### 0000
Texto traducido

##### 0001
Otro texto traducido

TEXTO A TRADUCIR:
${textoOriginal}`;

async function traducir() {
    console.log('Enviando a DeepSeek...');
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
    const traducido = data.choices[0].message.content;
    
    // Contar marcadores traducidos
    const marcadoresTrad = (traducido.match(/^##### \d+/gm) || []).length;
    console.log(`Marcadores en la traduccion: ${marcadoresTrad}`);
    
    if (marcadoresTrad !== marcadoresOrig) {
        console.error(`!! ERROR: faltan ${marcadoresOrig - marcadoresTrad} marcadores. NO se ha guardado.`);
        fs.writeFileSync(OUTPUT.replace('.txt', '_FALLO.txt'), traducido, 'utf-8');
        process.exit(1);
    }
    
    fs.mkdirSync('C:\\Users\\david\\Desktop\\retraduccion', { recursive: true });
    fs.writeFileSync(OUTPUT, traducido, 'utf-8');
    console.log(`OK guardado en ${OUTPUT}`);
}

traducir().catch(e => console.error(e));