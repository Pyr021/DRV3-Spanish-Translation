import fs from 'fs';
const buf = fs.readFileSync('C:\\Users\\david\\Desktop\\monopad_option\\flash.sfl');
console.log('Tamaño:', buf.length, 'bytes');
console.log('Primeros 32 bytes en hex:');
for (let i = 0; i < 32; i++) {
    process.stdout.write(buf[i].toString(16).padStart(2, '0') + ' ');
    if ((i + 1) % 16 === 0) console.log('');
}
console.log('\nPrimeros 32 bytes como ASCII:');
console.log(buf.slice(0, 32).toString('ascii').replace(/[^\x20-\x7E]/g, '.'));