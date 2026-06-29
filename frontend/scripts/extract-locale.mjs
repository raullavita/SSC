import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nPath = path.join(__dirname, '../src/lib/i18n.js');
const s = fs.readFileSync(i18nPath, 'utf8');

function extract(lang) {
  const marker = `${lang}: {`;
  const start = s.indexOf(marker);
  if (start < 0) throw new Error(`missing ${lang}`);
  let i = start + marker.length;
  let depth = 1;
  while (i < s.length && depth > 0) {
    const ch = s[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    i += 1;
  }
  const body = s.slice(start + marker.length, i - 1);
  const out = {};
  const keyRe = /^\s+(\w+):\s*(['"`])((?:\\.|(?!\2)[\s\S])*?)\2,?\s*$/gm;
  let m;
  while ((m = keyRe.exec(body)) !== null) {
    const key = m[1];
    const quote = m[2];
    let val = m[3];
    if (quote === "'") val = val.replace(/\\'/g, "'");
    if (quote === '"') val = val.replace(/\\"/g, '"');
    if (quote === '`') val = val.replace(/\\`/g, '`');
    out[key] = val;
  }
  return out;
}

const en = extract('en');
const outDir = path.join(__dirname, '../src/lib/locales');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, '_en.extract.json'), JSON.stringify(en, null, 2));
console.log(`extracted ${Object.keys(en).length} keys`);