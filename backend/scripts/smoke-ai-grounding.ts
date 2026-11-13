import { prisma } from '../src/infrastructure/database/prisma';
import { buildMarketContext, renderContextForPrompt } from '../src/modules/ai/market-context.service';

async function main() {
  const bundle = await buildMarketContext({
    question: 'What do the stored listings show about median prices and rent in Bole over the last 12 months?',
    months: 12,
  });
  console.log('SCOPE', JSON.stringify(bundle.scope));
  console.log('COUNTS', JSON.stringify(bundle.counts));
  console.log('FACTS', bundle.facts.length, 'CALCS', bundle.calculations.length);
  console.log('FIRST FACTS:\n' + bundle.facts.slice(0, 5).map((f) => ` [${f.quality}] ${f.statement}`).join('\n'));
  console.log('CALCS:\n' + bundle.calculations.map((c) => ` - ${c.statement}`).join('\n'));
  console.log('UNAVAILABLE:\n' + bundle.unavailable.map((u) => ` - ${u}`).join('\n'));
  console.log('CITATIONS', bundle.citations.map((c) => c.label + ' -> ' + c.url));
  const prompt = renderContextForPrompt(bundle);
  console.log('PROMPT CHARS', prompt.length);
  console.log(prompt.slice(0, 700));
  // Property-scoped retrieval
  const property = await prisma.property.findFirst({ where: { status: 'APPROVED' }, select: { id: true } });
  if (property) {
    const withProperty = await buildMarketContext({
      question: 'Is this property priced above its neighborhood median?',
      propertyId: property.id,
      months: 12,
    });
    console.log('PROPERTY FACTS', withProperty.facts.filter((f) => f.kind === 'property' || f.kind === 'listing').length,
      'CALCS', withProperty.calculations.filter((c) => c.kind === 'property').length);
  }
  await prisma.$disconnect();
}
main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
