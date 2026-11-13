/* One-off repair of syntax damaged by the unused-declaration cleanup pass. */
const fs = require('fs');
const path = require('path');

const edits = [
  {
    file: 'src/pages/admin/AdminProfilePage.tsx',
    find: `  const  = () => {
    if (window.confirm('Are you sure you want to remove your avatar?')) {
      deleteAvatarMutation.mutate();
    }
  };

`,
    replace: '',
  },
  {
    file: 'src/pages/admin/DataSourcesPage.tsx',
    find: `  const  = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500/20 text-green-700';
      case 'syncing': return 'bg-blue-500/20 text-blue-700';
      case 'failed': return 'bg-red-500/20 text-red-700';
      default: return 'bg-slate-800/50 text-gray-300';
    }
  };

`,
    replace: '',
  },
  {
    file: 'src/pages/properties/PropertyExplorerPage.tsx',
    find: `  const  = (value: string) => {
    setSearchQuery(value);
    setFilters(prev => ({ 
      ...prev, 
      search: value,
      page: 1 // Reset to first page when search changes
    }));
  };

`,
    replace: '',
  },
  {
    file: 'src/pages/analyst/AnalystNeighborhoodsPage.tsx',
    find: 'interface  {',
    replace: 'interface MockNeighborhood {',
  },
];

for (const edit of edits) {
  const abs = path.resolve(edit.file);
  const before = fs.readFileSync(abs, 'utf8');
  if (!before.includes(edit.find)) {
    console.log(`MISS ${edit.file}`);
    continue;
  }
  fs.writeFileSync(abs, before.split(edit.find).join(edit.replace));
  console.log(`fixed ${edit.file}`);
}

// Restore stripped parameter names on the mock fetchers.
const paramFiles = [
  'src/pages/analyst/AnalystDashboardPage.tsx',
  'src/pages/analyst/AnalystPropertiesPage.tsx',
  'src/pages/analyst/MarketExplorerPage.tsx',
  'src/pages/analyst/MarketTrendsPage.tsx',
  'src/pages/analyst/PricingAnalysisPage.tsx',
  'src/pages/market/DashboardPage.tsx',
  'src/pages/properties/MyPropertiesPage.tsx',
];

for (const file of paramFiles) {
  const abs = path.resolve(file);
  let text = fs.readFileSync(abs, 'utf8');
  const before = text;
  text = text.split('async (: any)').join('async (_args: any)');
  if (text !== before) {
    fs.writeFileSync(abs, text);
    console.log(`params restored ${file}`);
  }
}
