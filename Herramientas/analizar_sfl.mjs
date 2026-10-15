import fs from 'fs';

const filepath = 'C:\\Users\\david\\Desktop\\monopad_option\\flash.sfl';
const buf = fs.readFileSync(filepath);
console.log(`Tamaño: ${buf.length} bytes\n`);

// Buscar patrones de bytes que puedan ser offsets o longitudes
// Buscamos secuencias de 4 bytes que apunten a posiciones dentro del archivo
const posiblesOffsets = [];
for (let i = 0; i < buf.length - 4; i += 4) {
    const val = buf.readUInt32LE(i);
    if (val > 0 && val < buf.length && val !== i) {
        posiblesOffsets.push({ offset: i, value: val });
    }
}

console.log(`Posibles offsets encontrados: ${posiblesOffsets.length}`);
posiblesOffsets.slice(0, 20).forEach(o => {
    console.log(`  Posición 0x${o.offset.toString(16)} -> apunta a 0x${o.value.toString(16)}`);
});