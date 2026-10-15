import fs from 'fs';
import path from 'path';

const BASE = 'C:\\Users\\david\\Desktop\\hgy\\CriPakTools_x64\\partition_data_win_us.cpk_unpacked';
const PALABRAS = ['Option', 'Volume', 'Language', 'Return', 'Back', 'System', 'Setting', 'Sound', 'Display'];

function walk(dir) {
    const results = [];
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) results.push(...walk(full));
        else if (item.isFile() && item.name.toLowerCase().endsWith('.spc')) results.push(full);
    }
    return results;
}

// Buscar en la carpeta techou y en wrd_data y en flash/adv
const carpetas = [
    path.join(BASE, 'flash', 'techou'),
    path.join(BASE, 'wrd_data'),
    path.join(BASE, 'flash', 'adv', 'spcpack'),
];

for (const carpeta of carpetas) {
    if (!fs.existsSync(carpeta)) continue;
    const spcFiles = walk(carpeta);
    console.log(`\n=== ${carpeta} (${spcFiles.length} archivos) ===`);
    for (const spc of spcFiles) {
        const buf = fs.readFileSync(spc);
        const texto = buf.toString('latin1');
        for (const palabra of PALABRAS) {
            if (texto.includes(palabra)) {
                console.log(`  ${path.basename(spc)} contiene "${palabra}"`);
                break;
            }
        }
    }
}