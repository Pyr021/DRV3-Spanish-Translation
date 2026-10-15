import fs from 'fs';

function parseSrd(filePath) {
  const buf = fs.readFileSync(filePath);
  let pos = 0;
  const textures = [];

  while (pos < buf.length) {
    if (buf[pos] !== 0x24) break;
    const type = buf.slice(pos, pos + 4).toString('ascii');
    pos += 4;
    const dataLen = buf.readUInt32BE(pos); pos += 4;
    const subLen = buf.readUInt32BE(pos); pos += 4;
    pos += 4;
    const dataPad = (0x10 - dataLen % 0x10) % 0x10;
    const subPad = (0x10 - subLen % 0x10) % 0x10;
    const data = buf.slice(pos, pos + dataLen);
    pos += dataLen + dataPad;
    const subdata = buf.slice(pos, pos + subLen);
    pos += subLen + subPad;

    if (type !== '$TXR') continue;

    // TXR data (LE)
    const dispW = data.readUInt16LE(6);
    const dispH = data.readUInt16LE(8);
    const fmt = data.readUInt8(12);

    // subdata → inner item
    let sp = 4;
    const innerDataLen = subdata.readUInt32BE(sp); sp += 4;
    sp += 8;
    const innerDataPad = (0x10 - innerDataLen % 0x10) % 0x10;
    const innerData = subdata.slice(sp, sp + innerDataLen);

    // innerData: 2 + 1 (unk5) + 1 (mipmapCount) + 8 + 4 (nameOffset) = 16
    let ip = 16;
    const mipStart = innerData.readUInt32LE(ip) & 0x0FFFFFFF; ip += 4;
    const mipLen = innerData.readUInt32LE(ip); ip += 4;
    const nameOffset = innerData.readUInt32LE(12);
    let nameEnd = nameOffset;
    while (nameEnd < innerData.length && innerData[nameEnd] !== 0) nameEnd++;
    const name = innerData.slice(nameOffset, nameEnd).toString('utf-8');

    const fmtName = fmt === 0x0F ? 'DXT1' : fmt === 0x1C ? 'BC7' : '0x' + fmt.toString(16);

    textures.push({ name, offset: mipStart, len: mipLen, width: dispW, height: dispH, fmt, fmtName });
  }
  return textures;
}

const textures = parseSrd(process.argv[2]);
console.log('name | offset | len | w | h | fmt');
for (const t of textures) {
  console.log(`${t.name} | 0x${t.offset.toString(16)} | ${t.len} | ${t.width} | ${t.height} | ${t.fmtName}`);
}