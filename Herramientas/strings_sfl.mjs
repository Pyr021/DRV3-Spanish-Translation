import fs from 'fs';
const filepath = process.argv[2] || 'C:\\Users\\david\\Desktop\\monopad_option\\flash.sfl';
const buf = fs.readFileSync(filepath);
console.log(`Tamaño: ${buf.length} bytes\n`);

// Extraer strings ASCII de al menos 3 caracteres
const strings = [];
let current = '';
let start = 0;
for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b >= 32 && b <= 126) {
        if (current === '') start = i;
        current += String.fromCharCode(b);
    } else {
        if (current.length >= 3) {
            strings.push({ offset: start, text: current });
        }
        current = '';
    }
}
if (current.length >= 3) strings.push({ offset: start, text: current });

console.log(`Encontradas ${strings.length} cadenas:\n`);
strings.forEach(s => {
    console.log(`[0x${s.offset.toString(16).padStart(6, '0')}] "${s.text}"`);
});