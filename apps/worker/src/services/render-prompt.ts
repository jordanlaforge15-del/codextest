import type { Item, Workspace } from '@mvp/shared';

function describeItem(item: Item, index: number): string {
  const metadataPairs = Object.entries(item.metadataJson ?? {})
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`);

  const parts = [
    `Item ${index + 1}`,
    `title: ${item.title ?? 'untitled piece'}`,
    `slot/category: ${item.slotType ?? 'unspecified'}`,
    `role: ${item.role}`,
    item.brand ? `brand: ${item.brand}` : null,
    item.merchant ? `merchant: ${item.merchant}` : null,
    metadataPairs.length > 0 ? `metadata: ${metadataPairs.join(', ')}` : null
  ].filter(Boolean);

  return parts.join(' | ');
}

export function buildRenderPrompt(workspace: Workspace, items: Item[]): string {
  const intention = workspace.intentionText?.trim()
    ? `Workspace intention: ${workspace.intentionText.trim()}`
    : 'Workspace intention: none provided';
  const itemLines = items.map(describeItem).join('\n');

  return [
    'Create one realistic image of a single person wearing all supplied garments together as one coherent outfit.',
    'This is a garment-composition and outfit-visualization request, not a body-specific try-on or identity-preserving portrait task.',
    'Use every supplied clothing image as a direct reference input for the final outfit.',
    'Preserve garment colors, visible materials, textures, trims, closures, and major design features.',
    'Preserve overall garment proportions and silhouette as closely as possible.',
    'Do not invent different garment designs or swap the garments for lookalikes.',
    'Put all supplied garments on the same person in one clean, believable composition.',
    'If there are fixed pieces, treat them as anchors and style the candidate pieces around them.',
    'Keep the presentation realistic, cohesive, and focused on how the outfit works together visually.',
    `Workspace domain: ${workspace.domainType}`,
    intention,
    'Selected items:',
    itemLines
  ].join('\n');
}
