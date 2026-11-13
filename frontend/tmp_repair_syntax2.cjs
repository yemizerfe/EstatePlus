/* One-off: repair remaining syntax damage (stripped param names, import aliases). */
const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const files = walk(path.resolve('src'));
let touched = 0;

for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  const before = text;

  // `async (: File: string)` -> `async (_arg1: File, _arg2: string)`
  text = text.replace(/async \(: ([A-Za-z_$][\w$.]*)!?: ([^{)]*?)\)/g, 'async (_arg1: $1, _arg2: $2)');
  // `async (: number)` -> `async (_arg1: number)`
  text = text.replace(/async \(: ([^:)]*(?:<[^>]*>)?)\)/g, 'async (_arg1: $1)');
  // `(a: string, : number)` -> `(a: string, _arg: number)`
  text = text.replace(/,\s*: ([A-Za-z_$][\w$.]*(?:\[[^\]]*\])?(?:\s*\|\s*[\w$.]+)*)\)/g, ', _arg1: $1)');
  // `MapPin as \n}` -> `MapPin,\n}`
  text = text.replace(/([A-Za-z_$][\w$]*)\s+as\s*\n(\s*)\}/g, '$1\n$2}');
  text = text.replace(/([A-Za-z_$][\w$]*)\s+as\s*,/g, '$1,');
  text = text.replace(/([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)?\s*(\r?\n)/g, '$1$3');

  if (text !== before) {
    fs.writeFileSync(file, text);
    touched += 1;
    console.log('patched', path.relative(process.cwd(), file));
  }
}
console.log('files touched:', touched);
