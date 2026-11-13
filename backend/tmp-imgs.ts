import { prisma } from './src/infrastructure/database/prisma';
(async () => {
  const imgs = await prisma.propertyImage.findMany({ take: 40, select: { imageUrl: true, isPrimary: true, property: { select: { title: true, propertyType: true, bedrooms: true } } } });
  for (const i of imgs) console.log(i.property.propertyType, i.property.bedrooms, '|', i.imageUrl.slice(0, 110), '|', i.property.title?.slice(0, 40));
  const props = await prisma.property.count();
  const withImgs = await prisma.property.count({ where: { images: { some: {} } } });
  console.log('props', props, 'withImages', withImgs);
  await prisma.$disconnect();
})();
