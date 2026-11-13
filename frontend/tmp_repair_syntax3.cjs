/* One-off: delete dead blocks left nameless by the unused-cleanup pass. */
const fs = require('fs');
const path = require('path');

function deleteBlock(file, startMarker, endMarker) {
  const abs = path.resolve(file);
  const text = fs.readFileSync(abs, 'utf8');
  const start = text.indexOf(startMarker);
  if (start === -1) {
    console.log('MISS start', file);
    return;
  }
  const end = text.indexOf(endMarker, start);
  if (end === -1) {
    console.log('MISS end', file);
    return;
  }
  const after = end + endMarker.length;
  fs.writeFileSync(abs, text.slice(0, start) + text.slice(after));
  console.log('deleted block in', file);
}

// Dead search handler (unused; search input is wired through setFilters).
deleteBlock(
  'src/pages/properties/PropertyExplorerPage.tsx',
  '  const  = (value: string) => {',
  '  };\n\n'
);

// Two mock trend fetchers; the page reads real data from the public API.
deleteBlock(
  'src/pages/analyst/MarketTrendsPage.tsx',
  'const  = async (_args: any) => ({',
  '});\n\n'
);
deleteBlock(
  'src/pages/analyst/MarketTrendsPage.tsx',
  'const  = async (_args: any) => ({',
  '});'
);
