import fs from 'fs';
import path from 'path';

const API_KEY = process.env.DEEPSEEK_API_KEY || '';
if (!API_KEY) {
  console.error('Falta la variable de entorno DEEPSEEK_API_KEY.\n  PowerShell: $env:DEEPSEEK_API_KEY="sk-..."');
  process.exit(2);
}
const MODEL = 'deepseek-chat';

function walkTxtFiles(dir) {
  const results = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) results.push(...walkTxtFiles(full));
    else if (item.isFile() && item.name.toLowerCase().endsWith('.txt')) results.push(full);
  }
  return results;
}

async function traducirArchivo(txtContent, glosario, personajes) {
  const instrucciones = `Eres un traductor profesional de videojuegos japoneses al español (España). Vas a traducir diálogos de Danganronpa V3: Killing Harmony.

REGLAS OBLIGATORIAS:
1. Traduce al español de España manteniendo el tono original (misterio, humor, drama).
2. Usa estrictamente esta terminología:
${glosario}

PERSONAJES Y GENERO (MUY IMPORTANTE):
${personajes}

3. NUNCA modifiques las etiquetas de formato <CLT=...>, <PAD=...>, <DIG=...> ni <RUBY=...>. Por ejemplo, <CLT=cltSTRONG>, <PAD=【○】> o <DIG=●> deben aparecer EXACTAMENTE igual en la traducción.
3b. Si un texto está en japonés o tiene caracteres raros (kanji, katakana), déjalo tal cual sin traducir.
4. NUNCA modifiques los marcadores "##### NNNN" que aparecen al inicio de cada línea. Deben quedar idénticos.
5. Mantén el mismo número de "##### NNNN" que el original. No añadas ni quites líneas.
6. NO incluyas introducciones, despedidas, explicaciones ni confirmaciones. Devuelve ÚNICAMENTE el texto traducido con el mismo formato.
7. Si una línea ya está en español o es un nombre propio (Monokuma, Shuichi, Kaede...), déjala tal cual.
8. Respeta los saltos de línea internos que separan la primera parte de la segunda dentro de cada bloque "#####".
9. Los textos entre paréntesis que sean acciones de personajes (<DIG=●>, etc.) tradúcelos manteniendo las etiquetas intactas.
10. NUNCA traduzcas los nombres propios de personajes, lugares o términos exclusivos de la saga (Monokuma, Monokubs, Exisals, Atua, Neo-Aikido, etc.). En esos casos déjalos tal cual.

REGLA CRITICA DE GENERO GRAMATICAL:
- Cuando un adjetivo, participio o pronombre se refiera a un personaje, usa SIEMPRE el genero correcto segun la lista de personajes.
- Ejemplos: "Eres tonta" (si habla a Kaede), "Eres tonto" (si habla a Shuichi), "Estoy cansada" (si habla Kaede), "Estoy cansado" (si habla Shuichi).
- Aplica esto tambien a articulos: "el/la", "un/una", "este/esta" cuando se refieran a un personaje conocido.

REGLAS DE CARACTERES ESPECIALES (MUY IMPORTANTE):
- USA tildes correctamente (á, é, í, ó, ú, Á, É, Í, Ó, Ú).
- USA la letra Ñ cuando corresponda (ñ, Ñ).
- USA los signos de apertura ¿ y ¡ correctamente.
- USA la diéresis ü cuando corresponda.
- NO uses comillas tipograficas. Usa comillas rectas " ".
- NO uses guiones largos —. Usa guiones normales -.

FORMATO DE ENTRADA:
##### 0000
Texto original en inglés (puede tener
varias líneas)

##### 0001
Otro texto...

FORMATO DE SALIDA (idéntico pero traducido):
##### 0000
Texto traducido al espanol (puede tener
varias líneas)

##### 0001
Otro texto traducido...

TEXTO A TRADUCIR:
${txtContent}`;

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: instrucciones }],
      temperature: 0.3
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

const [, , inputDir, outputDir, glosarioPath] = process.argv;
if (!inputDir || !outputDir || !glosarioPath) {
  console.error('Uso: node traductor_stx.mjs <carpeta_txt_entrada> <carpeta_txt_salida> <ruta_glosario>');
  process.exit(1);
}

const glosario = fs.readFileSync(glosarioPath, 'utf-8');
const personajesPath = 'C:\\Users\\david\\traductor_v3\\personajes.txt';
let personajes = '';
if (fs.existsSync(personajesPath)) {
  personajes = fs.readFileSync(personajesPath, 'utf-8');
  console.log('Descripciones de personajes cargadas.');
} else {
  console.warn('AVISO: no se encontro personajes.txt. La traduccion no tendra en cuenta el genero de los personajes.');
}

const txtFiles = walkTxtFiles(inputDir);
console.log(`Encontrados ${txtFiles.length} archivos .txt`);

let ok = 0, fail = 0;

for (const txtFile of txtFiles) {
  const rel = path.relative(inputDir, txtFile);
  const outFile = path.join(outputDir, rel);
  if (fs.existsSync(outFile)) {
    console.log(`[SKIP] ${rel} ya existe`);
    ok++;
    continue;
  }
  try {
    console.log(`[TRADUCIENDO] ${rel}`);
    const content = fs.readFileSync(txtFile, 'utf-8');
    const traducido = await traducirArchivo(content, glosario, personajes);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, traducido, 'utf-8');
    console.log(`  → OK (${traducido.length} bytes)`);
    ok++;
  } catch (e) {
    console.error(`  → ERROR: ${e.message}`);
    fail++;
  }
  await new Promise(r => setTimeout(r, 1500));
}

console.log(`\nListo. ${ok} OK, ${fail} fallos.`);
console.log(`Salida: ${outputDir}`);