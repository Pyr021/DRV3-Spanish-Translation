import fs from 'fs';

const buf = fs.readFileSync(process.argv[2]);
let pos = 0;

function u8() { return buf[pos++]; }
function u16LE() { const v = buf.readUInt16LE(pos); pos += 2; return v; }
function u32LE() { const v = buf.readUInt32LE(pos); pos += 4; return v; }
function u16BE() { const v = buf.readUInt16BE(pos); pos += 2; return v; }
function u32BE() { const v = buf.readUInt32BE(pos); pos += 4; return v; }
function hex(n, w = 2) { return n.toString(16).padStart(w, '0'); }

let idx = 0;
while (pos < buf.length) {
  if (buf[pos] !== 0x24) break;
  const type = buf.slice(pos, pos + 4).toString('ascii');
  pos += 4;
  // Container: BIG ENDIAN
  const dataLen = u32BE();
  const subLen = u32BE();
  const pad = u32BE();
  const dataPad = (0x10 - dataLen % 0x10) % 0x10;
  const subPad = (0x10 - subLen % 0x10) % 0x10;
  const data = buf.slice(pos, pos + dataLen);
  pos += dataLen + dataPad;
  const subdata = buf.slice(pos, pos + subLen);
  pos += subLen + subPad;

  console.log(`[${idx}] ${type} dataLen=${dataLen} subLen=${subLen} (container pos=${pos})`);

  if (type === '$TXR') {
    // TXR data: LITTLE ENDIAN
    const unk1 = data.readUInt32LE(0);
    const swiz = data.readUInt16LE(4);
    const dispW = data.readUInt16LE(6);
    const dispH = data.readUInt16LE(8);
    const scanline = data.readUInt16LE(10);
    const fmt = data.readUInt8(12);
    const unk2 = data.readUInt8(13);
    const pal = data.readUInt8(14);
    const palId = data.readUInt8(15);
    console.log(`  unk1=0x${hex(unk1,8)} swiz=0x${hex(swiz,4)} ${dispW}x${dispH} scanline=${scanline} fmt=0x${hex(fmt)} unk2=0x${hex(unk2)}`);

    // Parsear subdata (que contiene $RSI)
    let sp = 0;
    const innerType = subdata.slice(sp, sp + 4).toString('ascii'); sp += 4;
    const innerDataLen = subdata.readUInt32BE(sp); sp += 4;
    const innerSubLen = subdata.readUInt32BE(sp); sp += 4;
    sp += 4;
    const innerDataPad = (0x10 - innerDataLen % 0x10) % 0x10;
    const innerData = subdata.slice(sp, sp + innerDataLen);

    console.log(`  innerType=${innerType} innerDataLen=${innerDataLen}`);

    // innerData: el contenido del $RSI
    // Primeros bytes: 06 05 unk5 mipmapCount [4 pad] [4 pad] nameOffset(4)
    let ip = 0;
    ip += 2;
    const unk5 = innerData.readUInt8(ip++);
    const mipmapCount = innerData.readUInt8(ip++);
    ip += 8;
    const nameOffset = innerData.readUInt32LE(ip); ip += 4;
    console.log(`  unk5=0x${hex(unk5)} mipmapCount=${mipmapCount} nameOffset=0x${hex(nameOffset,4)}`);

    for (let i = 0; i < mipmapCount; i++) {
      const start = innerData.readUInt32LE(ip); ip += 4;
      const len = innerData.readUInt32LE(ip); ip += 4;
      const unk1b = innerData.readUInt32LE(ip); ip += 4;
      const unk2b = innerData.readUInt32LE(ip); ip += 4;
      const realStart = start & 0x0FFFFFFF;
      console.log(`    mip[${i}] start=0x${hex(realStart,8)} len=${len} unk1=0x${hex(unk1b,8)} unk2=0x${hex(unk2b,8)}`);
    }

    // Dump del RSI data completo en hex para análisis
    console.log('  RSI data (hex):');
    for (let h = 0; h < innerData.length; h += 16) {
      const chunk = innerData.slice(h, Math.min(h + 16, innerData.length));
      const hexPart = Array.from(chunk).map(b => hex(b)).join(' ');
      const asciiPart = Array.from(chunk).map(b => b >= 32 && b <= 126 ? String.fromCharCode(b) : '.').join('');
      console.log(`    +${hex(h, 4)}: ${hexPart.padEnd(48)} ${asciiPart}`);
    }
  }
  idx++;
}