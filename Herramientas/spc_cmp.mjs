function bitReverse(b) {
    let r = 0;
    for (let i = 0; i < 8; i++) { r = (r << 1) | (b & 1); b >>= 1; }
    return r & 0xFF;
}

export function spcCmp(decData) {
    const decSize = decData.length;
    const out = [];
    let pos = 0;
    let flag = 0;
    let curFlagBit = 0;
    let block = [];

    while (true) {
        if (curFlagBit === 8 || pos >= decSize) {
            out.push(bitReverse(flag));
            for (const b of block) out.push(b);
            block = [];
            flag = 0;
            curFlagBit = 0;
        }
        if (pos >= decSize) break;

        const lookaheadLen = Math.min(decSize - pos, 65);
        const searchbackLen = Math.min(pos, 1024);

        // Find largest matching sequence
        let s = -1;
        let l = 1;
        let seq = [decData[pos]];
        
        for (l; l <= lookaheadLen; l++) {
            const lastS = s;
            if (searchbackLen < 1) break;

            // Search for seq in the window
            const windowStart = pos - searchbackLen;
            const windowEnd = pos + (lookaheadLen - 1);
            s = -1;
            for (let i = pos - 1; i >= windowStart; i--) {
                let match = true;
                for (let k = 0; k < seq.length; k++) {
                    if (decData[i + k] !== seq[k]) { match = false; break; }
                }
                if (match) { s = i - windowStart; break; }
            }

            if (s === -1) {
                if (l > 1) { l--; seq.pop(); }
                s = lastS;
                break;
            }
            if (l === lookaheadLen) break;
            seq.push(decData[pos + l]);
        }

        if (l >= 2 && s !== -1) {
            const repeatData = (1024 - searchbackLen + s) | ((l - 2) << 10);
            block.push(repeatData & 0xFF);
            block.push((repeatData >> 8) & 0xFF);
        } else {
            flag |= (1 << curFlagBit);
            block.push(decData[pos]);
        }

        curFlagBit++;
        pos += l;
    }

    return Buffer.from(out);
}