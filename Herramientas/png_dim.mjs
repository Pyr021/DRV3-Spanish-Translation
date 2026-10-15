import fs from 'fs';
const dir = process.argv[2];
for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith('.png')) continue;
  const buf = fs.readFileSync(`${dir}/${file}`);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  console.log(`${file}: ${w}x${h}`);
}