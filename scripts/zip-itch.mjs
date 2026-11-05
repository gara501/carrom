// Empaqueta el build para itch.io: index.html debe quedar en la RAÍZ del zip.
import AdmZip from 'adm-zip';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve('build/itch');
if (!existsSync(resolve(dir, 'index.html'))) { console.error('Falta build/itch/index.html: corre primero el build.'); process.exit(1); }
const zip = new AdmZip();
zip.addLocalFolder(dir);
const out = resolve('build/carrom-itch.zip');
zip.writeZip(out);
console.log(`Listo: ${out} (${(statSync(out).size / 1048576).toFixed(1)} MB)`);
