import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const workspace = await prisma.workspace.create({
    data: {
      title: 'Spring Closet Refresh',
      intentionText: 'Collect potential outfit pieces for a capsule wardrobe.',
      domainType: 'outfit'
    }
  });

  await prisma.item.createMany({
    data: [
      {
        workspaceId: workspace.id,
        title: 'Linen Shirt',
        brand: 'Everlane',
        merchant: 'Everlane',
        pageUrl: 'https://example.com/linen-shirt',
        imageUrl: 'https://images.example.com/linen-shirt.jpg',
        role: 'candidate',
        metadataJson: {
          color: 'white',
          fit: 'relaxed'
        }
      },
      {
        workspaceId: workspace.id,
        title: 'Straight Denim',
        brand: 'Levi\'s',
        merchant: 'Levi\'s',
        pageUrl: 'https://example.com/straight-denim',
        imageUrl: 'https://images.example.com/straight-denim.jpg',
        role: 'fixed',
        metadataJson: {
          color: 'indigo',
          rise: 'mid'
        }
      }
    ]
  });

  console.log(`Seeded workspace ${workspace.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
