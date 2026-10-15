import fs from 'fs';

const buf = fs.readFileSync(process.argv[2]);
let pos = 0;

function u8() { return buf[pos++]; }
function u16() { const v = buf.readUInt16BE(pos); pos += 2; return v; }
function u32() { const v = buf.readUInt32BE(pos); pos += 4; return v; }
function hex(n, w = 2) { return n.toString(16).padStart(w, '0'); }

while (pos < buf.length) {
  if (buf[pos] !== 0x24) break;
  const type = buf.slice(pos, pos + 4).toString('ascii');
  pos += 4;
  const dataLen = u32();
  const subLen = u32();
  const pad = u32();
  const dataPad = (0x10 - dataLen % 0x10) % 0x10;
  const subPad = (0x10 - subLen % 0x10) % 0x10;
  const dataStart = pos;
  const data = buf.slice(dataStart, dataStart + dataLen);
  pos += dataLen + dataPad;
  const subStart = pos;
  const subdata = buf.slice(subStart, subStart + subLen);
  pos += subLen + subPad;

  console.log(`${type} dataLen=${dataLen} subLen=${subLen}`);

  if (type === '$TXR') {
    // Leer cabecera de la textura
    const swiz = data.readUInt16BE(2);
    const dispW = data.readUInt16BE(4);
    const dispH = data.readUInt16BE(6);
    const scanline = data.readUInt16BE(8);
    const fmt = data.readUInt8(10);
    const unk2 = data.readUInt8(11);
    const pal = data.readUInt8(12);
    const palId = data.readUInt8(13);
    console.log(`  swiz=0x${hex(swiz,4)} dispW=${dispW} dispH=${dispH} scanline=${scanline} fmt=0x${hex(fmt)} unk2=0x${hex(unk2)} pal=0x${hex(pal)} palId=0x${hex(palId)}`);

    // Leer el subitem dentro del subdata
    let sp = 0;
    if (subdata[sp] !== 0x24) { console.log('  !!! subdata no empieza con $'); }
    const innerType = subdata.slice(sp, sp + 4).toString('ascii'); sp += 4;
    const innerDataLen = subdata.readUInt32BE(sp); sp += 4;
    const innerSubLen = subdata.readUInt32BE(sp); sp += 4;
    const innerPad = subdata.readUInt32BE(sp); sp += 4;
    const innerDataPad = (0x10 - innerDataLen % 0x10) % 0x10;
    const innerSubPad = (0x10 - innerSubLen % 0x10) % 0x10;
    const innerData = subdata.slice(sp, sp + innerDataLen); sp += innerDataLen + innerDataPad;
    const innerSub = subdata.slice(sp, sp + innerSubLen); sp += innerSubLen + innerSubPad;

    console.log(`  innerType=${innerType} innerDataLen=${innerDataLen}`);

    // Leer el innerData
    let ip = 0;
    ip += 2; // 06 05
    const unk5 = innerData.readUInt8(ip++);
    const mipmapCount = innerData.readUInt8(ip++);
    ip += 8; // ???
    const nameOffset = innerData.readUInt32BE(ip); ip += 4;
    console.log(`  unk5=0x${hex(unk5)} mipmapCount=${mipmapCount} nameOffset=0x${hex(nameOffset,8)}`);

    for (let i = 0; i < mipmapCount; i++) {
      const start = innerData.readUInt32BE(ip); ip += 4;
      const len = innerData.readUInt32BE(ip); ip += 4;
      const unk1 = innerData.readUInt32BE(ip); ip += 4;
      const unk2 = innerData.readUInt32BE(ip); ip += 4;
      console.log(`    mip[${i}] start=0x${hex(start,8)} len=${len} unk1=0x${hex(unk1,8)} unk2=0x${hex(unk2,8)}`);
    }

    // Leer el nombre
    if (nameOffset < innerData.length) {
      let nameEnd = nameOffset;
      while (nameEnd < innerData.length && innerData[nameEnd] !== 0) nameEnd++;
      const name = innerData.slice(nameOffset, nameEnd).toString('utf-8');
      console.log(`    name="${name}"`);
    }
  }
}