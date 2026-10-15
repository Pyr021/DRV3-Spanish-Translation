import fs from 'fs';

const API_KEY = process.env.DEEPSEEK_API_KEY || '';
if (!API_KEY) {
    console.error('Falta la variable de entorno DEEPSEEK_API_KEY.\n  PowerShell: $env:DEEPSEEK_API_KEY="sk-..."');
    process.exit(2);
}

async function traducir() {
    console.log("1. Leyendo glosario y archivo de prueba...");
    const glosario = fs.readFileSync('glosario.txt', 'utf-8');
    const textoOriginal = fs.readFileSync('./textos_ingles/prueba_01.txt', 'utf-8');

    const instrucciones = `Eres un traductor experto de videojuegos.
REGLAS OBLIGATORIAS:
1. Traduce el texto al español neutro manteniendo el tono de misterio.
2. Usa esta terminología estrictamente:\n${glosario}
3. Mantén intactas TODAS las etiquetas de programación, variables y corchetes (ej: <color=red>, \\n, [0x05]). Si modificas esto, el juego colapsará.

TEXTO A TRADUCIR:
${textoOriginal}`;

    console.log("2. Conectando con el cerebro de DeepSeek...");
    const peticion = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${API_KEY}` 
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: instrucciones }]
        })
    });

    const respuesta = await peticion.json();
    const textoTraducido = respuesta.choices[0].message.content;

    console.log("3. Escribiendo el archivo traducido...");
    fs.writeFileSync('./textos_traducidos/prueba_01.txt', textoTraducido);
    console.log("¡ÉXITO! Tu archivo está listo en la carpeta textos_traducidos.");
}

traducir();