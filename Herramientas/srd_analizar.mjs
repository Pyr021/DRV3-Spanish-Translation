import fs from 'fs';

class BinaryReader {
  constructor(buf) { this.buf = buf; this.pos = 0; }
  read(n) { const r = this.buf.slice(this.pos, this.pos + n); this.pos += n; return r; }
  u8() { return this.buf.readUInt8(this.pos++); }
  u16() { const r = this.buf.readUInt16BE(this.pos); this.pos += 2; return r; }
  u32() { const r = this.buf.readUInt32BE(this.pos); this.pos += 4; return r; }
  str() { let s = ''; while (this.pos < this.buf.length) { const c = this.buf[this.pos++]; if (c === 0) break; s += String.fromCharCode(c); } return s; }
  seek(p) { this.pos = p; }
  remaining() { return this.buf.length - this.pos; }
}

function readSrdItem(r) {
  if (r.remaining() < 4) return null;
  const typeBytes = r.buf.slice(r.pos, r.pos + 4);
  if (typeBytes[0] !== 0x24) return null; // '$'
  const dataType = typeBytes.toString('ascii');
  r.pos += 4;
  const dataLen = r.u32();
  const subdataLen = r.u32();
  const padding = r.u32();
  const dataPadding = (0x10 - dataLen % 0x10) % 0x10;
  const subdataPadding = (0x10 - subdataLen % 0x10) % 0x10;
  const data = r.read(dataLen);
  r.read(dataPadding);
  const subdata = r.read(subdataLen);
  r.read(subdataPadding);
  return { dataType, data, subdata };
}

function parseTxr(data) {
  const r = new BinaryReader(data);
  const unk1 = r.u32();
  const swiz = r.u16();
  const dispWidth = r.u16();
  const dispHeight = r.u16();
  const scanline = r.u16();
  const fmt = r.u8();
  const unk2 = r.u8();
  const palette = r.u8();
  const paletteId = r.u8();
  return { unk1, swiz, dispWidth, dispHeight, scanline, fmt, unk2, palette, paletteId, swizzled: !(swiz & 1) };
}

function parseSubdata(subdata) {
  const r = new BinaryReader(subdata);
  const inner = readSrdItem(r);
  if (!inner) return null;
  const ir = new BinaryReader(inner.data);
  ir.read(2);
  const unk5 = ir.u8();
  const mipmapCount = ir.u8();
  ir.read(4);
  ir.read(4);
  const nameOffset = ir.u32();
  const mipmaps = [];
  for (let i = 0; i < mipmapCount; i++) {
    const start = ir.u32() & 0x0FFFFFFF;
    const len = ir.u32();
    const unk1 = ir.u32();
    const unk2 = ir.u32();
    mipmaps.push({ start, len, unk1, unk2 });
  }
  ir.seek(nameOffset);
  const name = ir.str();
  return { name, unk5, mipmapCount, mipmaps, innerType: inner.dataType };
}

const srdPath = process.argv[2];
const buf = fs.readFileSync(srdPath);
const r = new BinaryReader(buf);

console.log(`Archivo: ${srdPath}`);
console.log(`Tamaño total: ${buf.length} bytes\n`);

let idx = 0;
while (r.remaining() > 0) {
  const item = readSrdItem(r);
  if (!item) break;
  console.log(`[${idx}] ${item.dataType} (data=${item.data.length}, subdata=${item.subdata.length})`);
  if (item.dataType === '$TXR') {
    const txr = parseTxr(item.data);
    console.log(`    swiz=0x${txr.swiz.toString(16)} swizzled=${txr.swizzled} ${txr.dispWidth}x${txr.dispHeight} fmt=0x${txr.fmt.toString(16)} unk2=0x${txr.unk2.toString(16)} unk5=${txr.unk2}`);
    const sub = parseSubdata(item.subdata);
    if (sub) {
      console.log(`    name="${sub.name}" mipmaps=${sub.mipmapCount} unk5=0x${sub.unk5.toString(16)}`);
      for (let i = 0; i < sub.mipmaps.length; i++) {
        const m = sub.mipmaps[i];
        console.log(`      mip[${i}]: start=0x${m.start.toString(16)} len=${m.len} unk1=0x${m.unk1.toString(16)} unk2=0x${m.unk2.toString(16)}`);
      }
    }
  } else if (item.dataType === '$RSF') {
    const rsr = new BinaryReader(item.data);
    rsr.read(4); rsr.read(4); rsr.read(4); rsr.read(4);
    const name = rsr.str();
    console.log(`    name="${name}"`);
  }
  idx++;
}