const fs = require('fs');
const content = fs.readFileSync('src/modules/scenarios/scenarios.service.ts', 'utf8');
const lines = content.split('\n');
let braceStack = [];
let lineNo = 0;
for (const line of lines) {
  lineNo++;
  let code = line;
  // handle // comments
  const singleLineComment = code.indexOf('//');
  const templateStr = code.indexOf('`');
  const singleQuote = code.indexOf("'");
  const doubleQuote = code.indexOf('"');
  const commentPos = [singleLineComment, templateStr, singleQuote, doubleQuote].filter(p => p !== -1).sort((a, b) => a - b);
  if (commentPos.length) {
    const pos = commentPos[0];
    code = code.substring(0, pos);
  }
  for (const ch of code) {
    if (ch === '{') braceStack.push(lineNo);
    if (ch === '}') {
      if (braceStack.length === 0) {
        console.log('UNMATCHED } at line', lineNo);
      } else {
        braceStack.pop();
      }
    }
  }
}
console.log('Remaining open braces:', braceStack);
if (braceStack.length > 0) {
  console.log('Last 10 open braces at EOF:', braceStack.slice(-10));
}
