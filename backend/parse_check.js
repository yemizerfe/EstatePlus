const ts = require('typescript');
const fs = require('fs');
const path = process.argv[2];
const text = fs.readFileSync(path, 'utf8');
const sf = ts.createSourceFile(path, text, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
const diags = sf.parseDiagnostics || [];
console.log('parse diagnostics:', diags.length);
for (const d of diags.slice(0, 10)) {
  const pos = sf.getLineAndCharacterOfPosition(d.start);
  console.log(`line ${pos.line + 1}:${pos.character + 1} code=${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
  const lineStart = text.lastIndexOf('\n', d.start - 1) + 1;
  const lineEnd = text.indexOf('\n', d.start);
  console.log('   >', JSON.stringify(text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)));
}
