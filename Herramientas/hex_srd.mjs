import fs from 'fs';
const path = process.argv[2];
const buf = fs.readFileSync(path);
console.log(`Tamaño: ${buf.length} bytes\n`);
console.log('Primeros 128 bytes:');
for (let i = 0; i < Math.min(128, buf.length); i += 16) {
  const hex = [];
  const ascii = [];
  for (let j = 0; j < 16 && i + j < buf.length; j++) {
    hex.push(buf[i+j].toString(16).padStart(2, '0'));
    const b = buf[i+j];
    ascii.push(b >= 32 && b <= 126 ? String.fromCharCode(b) : '.');
  }
  console.log(`0x${i.toString(16).padStart(4, '0')}: ${hex.join(' ').padEnd(48)} ${ascii.join('')}`);
}