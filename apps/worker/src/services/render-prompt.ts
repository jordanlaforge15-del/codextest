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
    'You are creating a visual style-combination preview from the supplied product images.',
    'Goal: show how the selected pieces work together visually as a combined concept composition.',
    'This is not a body-specific try-on or fit simulation.',
    'Preserve each item’s colors, silhouette, material cues, and general form as closely as possible.',
    'Use the supplied images as the primary reference for the garments and products in the composition.',
    'Compose them cleanly into a cohesive outfit or concept board preview with a neutral, product-focused presentation.',
    'If there are fixed pieces, treat them as anchors and style the candidate pieces around them.',
    `Workspace domain: ${workspace.domainType}`,
    intention,
    'Selected items:',
    itemLines
  ].join('\n');
}
