/* One-off helper: strips identifiers tsc reports as unused (TS6133/TS6196). */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function tscErrors() {
  let out = '';
  try {
    out = execSync('npx tsc --noEmit', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    out = `${e.stdout || ''}${e.stderr || ''}`;
  }
  return out.split(/\r?\n/).filter((l) => /error TS(6133|6196|6192)/.test(l));
}

function offsetFrom(text, line, col) {
  let idx = 0;
  for (let i = 0; i < line - 1; i += 1) {
    const nl = text.indexOf('\n', idx);
    if (nl === -1) return -1;
    idx = nl + 1;
  }
  return idx + col - 1;
}

function removeAt(text, offset, name) {
  if (text.slice(offset, offset + name.length) !== name) return null;

  // `import * as Foo from '...'` / `import Foo from '...'` / `import { a, Foo }` etc.
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  const lineEnd = text.indexOf('\n', offset);
  const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);

  // Whole default/namespace import: `import Foo from 'x';`
  if (/^\s*import\s+(\*\s+as\s+)?[A-Za-z0-9_$]+(,|\s+from)/.test(line) && line.trim().startsWith('import')) {
    // Only drop the whole statement when the removed name is the default/namespace one.
    const m = line.match(/^\s*import\s+(\*\s+as\s+)?([A-Za-z0-9_$]+)/);
    if (m && m[2] === name) {
      return text.slice(0, lineStart) + text.slice(lineEnd === -1 ? text.length : lineEnd + 1);
    }
  }

  const before = text.slice(Math.max(0, offset - 80), offset);
  const after = text.slice(offset + name.length, offset + name.length + 80);

  // Prefer removing a trailing comma (and following space/newline).
  const afterComma = after.match(/^\s*,\s*/);
  if (afterComma) {
    return text.slice(0, offset) + text.slice(offset + name.length + afterComma[0].length);
  }
  // Otherwise remove a preceding comma.
  const beforeComma = before.match(/,\s*$/);
  if (beforeComma) {
    return text.slice(0, offset - beforeComma[0].length) + text.slice(offset + name.length);
  }

  // Last resort: delete just the name.
  return text.slice(0, offset) + text.slice(offset + name.length);
}

let rounds = 0;
for (;;) {
  const errors = tscErrors();
  if (errors.length === 0) break;
  if (rounds > 8) {
    console.log(`stopping after ${rounds} rounds with ${errors.length} unused errors left`);
    break;
  }
  rounds += 1;

  const byFile = new Map();
  for (const line of errors) {
    const m = line.match(/^(.+?)\((\d+),(\d+)\): error TS\d+:/);
    if (!m) continue;
    const [, file, ln, col] = m;
    const nameMatch = line.match(/'(.+?)' is declared but/);
    if (!nameMatch) continue;
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push({ line: Number(ln), col: Number(col), name: nameMatch[1] });
  }

  let changed = 0;
  for (const [file, items] of byFile) {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) continue;
    let text = fs.readFileSync(abs, 'utf8');
    // Remove from the end of the file backwards so offsets stay valid.
    const withOffsets = items
      .map((it) => ({ ...it, offset: offsetFrom(text, it.line, it.col) }))
      .filter((it) => it.offset >= 0)
      .sort((a, b) => b.offset - a.offset);

    for (const item of withOffsets) {
      const next = removeAt(text, item.offset, item.name);
      if (next !== null && next !== text) {
        text = next;
        changed += 1;
      }
    }
    fs.writeFileSync(abs, text);
  }
  console.log(`round ${rounds}: removed ${changed} unused declarations (${errors.length} errors seen)`);
  if (changed === 0) break;
}
