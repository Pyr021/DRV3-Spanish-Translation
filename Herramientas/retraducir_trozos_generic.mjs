import fs from 'fs';
import path from 'path';

const API_KEY = process.env.DEEPSEEK_API_KEY || '';
if (!API_KEY) {
  console.error('Falta la variable de entorno DEEPSEEK_API_KEY.\n  PowerShell: $env:DEEPSEEK_API_KEY="sk-..."');
  process.exit(2);
}
const MODEL = 'deepseek-chat';
const ORIG_DIR = 'C:\\Users\\david\\Desktop\\game_resident_txt';
const TRAD_DIR = 'C:\\Users\\david\\Desktop\\game_resident_trad';
const GLOSARIO_PATH = 'C:\\Users\\david\\traductor_v3\\glosario.txt';
const PERSONAJES_PATH = 'C:\\Users\\david\\traductor_v3\\personajes.txt';
const TAMANO_TROZO = 10;

// Archivos a re-traducir
const ARCHIVOS = [
  'F-HelpOperateDesc.txt',
];

const glosario = fs.readFileSync(GLOSARIO_PATH, 'utf-8');
const personajes = fs.readFileSync(PERSONAJES_PATH, 'utf-8');

async function traducirTrozo(textoTrozo, numTrozo, totalTrozos, numBloquesOrig) {
  const instrucciones = `Eres un traductor profesional de videojuegos japoneses al español (España). Traduce los textos de Danganronpa V3.

REGLA ABSOLUTA Y CRITICA:
- Este trozo tiene EXACTAMENTE ${numBloquesOrig} marcadores "##### NNNN".
- Tu traducción DEBE tener EXACTAMENTE ${numBloquesOrig} marcadores "##### NNNN".
- Si te falta uno solo, el juego crashea. Es un requisito tecnico, no estilistico.
- NO juntes lineas. NO dividas lineas. NO omitas contenido. Cada "##### NNNN" del original DEBE tener su correspondiente "##### NNNN" en la traduccion.
- Los numeros deben ser SECUENCIALES y EXACTOS.

REGLAS:
1. Traduce al español de España.
2. Usa esta terminología:
${glosario}
PERSONAJES:
${personajes}
3. NUNCA modifiques las etiquetas <CLT=...>, <PAD=...>, <DIG=...> ni <RUBY=...>.
3b. Si un texto está en japonés o tiene caracteres raros (kanji, katakana), déjalo tal cual.
4. NO uses tildes (a, e, i, o, u sin acento).
5. NO uses la letra ñ. Escribe "n".
6. NO uses ¿ ni ¡.
7. Devuelve UNICAMENTE el texto traducido con el mismo formato, sin explicaciones.

TEXTO A TRADUCIR (trozo ${numTrozo}/${totalTrozos}):
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

async function retraducirArchivo(nombre) {
  const origPath = path.join(ORIG_DIR, nombre);
  const outPath = path.join(TRAD_DIR, nombre);

  const textoOriginal = fs.readFileSync(origPath, 'utf-8');
  const bloques = textoOriginal.split(/(?=^##### \d+)/m).filter(b => b.trim() !== '');
  console.log(`\n=== ${nombre} ===`);
  console.log(`Bloques totales: ${bloques.length}`);

  const trozos = [];
  for (let i = 0; i < bloques.length; i += TAMANO_TROZO) {
    trozos.push(bloques.slice(i, i + TAMANO_TROZO));
  }
  console.log(`Dividido en ${trozos.length} trozos.`);

  const resultados = [];

  for (let i = 0; i < trozos.length; i++) {
    const texto = trozos[i].join('');
    const numOrig = (texto.match(/^##### \d+/gm) || []).length;
    console.log(` Trozo ${i+1}/${trozos.length} (${numOrig} bloques)...`);

    let traducido = await traducirTrozo(texto, i+1, trozos.length, numOrig);
    let numTrad = (traducido.match(/^##### \d+/gm) || []).length;

    if (numTrad !== numOrig) {
      console.log(` Reintentando (${numTrad} != ${numOrig})...`);
      traducido = await traducirTrozo(texto, i+1, trozos.length, numOrig);
      numTrad = (traducido.match(/^##### \d+/gm) || []).length;
    }

    if (numTrad !== numOrig) {
      throw new Error(`Trozo ${i+1} fallo: ${numOrig} vs ${numTrad}`);
    }

    resultados.push(traducido);
    await new Promise(r => setTimeout(r, 1500));
  }

  const resultadoFinal = resultados.join('\n\n');
  const numFinal = (resultadoFinal.match(/^##### \d+/gm) || []).length;
  console.log(`Total bloques resultado: ${numFinal} (original: ${bloques.length})`);

  if (numFinal !== bloques.length) {
    throw new Error(`Total fallo: ${bloques.length} vs ${numFinal}`);
  }

  fs.writeFileSync(outPath, resultadoFinal, 'utf-8');
  console.log(`OK guardado: ${outPath}`);
}

async function main() {
  let ok = 0, fail = 0;
  for (const nombre of ARCHIVOS) {
    try {
      await retraducirArchivo(nombre);
      ok++;
    } catch (e) {
      console.error(`ERROR en ${nombre}: ${e.message}`);
      fail++;
    }
  }
  console.log(`\n=== RESUMEN ===`);
  console.log(`OK: ${ok}, Fallos: ${fail}`);
}

main().catch(e => { console.error(e); process.exit(1); });