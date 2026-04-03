import type { Item, Workspace } from '@mvp/shared';

export function buildRenderPrompt(workspace: Workspace, items: Item[]): string {
  const intentionText = workspace.intentionText?.trim() || `Create an outfit for workspace "${workspace.title}".`;
  const itemLines = items.map((item) => {
    return [
      `- title: ${item.title ?? 'Untitled item'}`,
      `slot/category: ${item.slotType ?? 'unknown'}`,
      `role: ${item.role}`
    ].join(' | ');
  });

  return [
    'Highest priority: the final image must show the complete person from head to toe with visible white margin above the head, below the feet, and on both sides.',
    intentionText,
    '',
    'Create a realistic straight-on full-body studio catalog image of a single person wearing all supplied garments together.',
    'This is not a body-specific try-on.',
    'The camera must be zoomed out enough to show the entire person from head to toe.',
    'The subject must be centered in frame and fully contained inside the image.',
    'Keep the full head, hair, hands, arms, legs, and shoes visible.',
    'Leave visible white space above the head, below the feet, and on both sides of the body.',
    'The person should occupy about 70 to 80 percent of the image height, not a tightly cropped frame.',
    'Do not crop any part of the body, hair, hands, feet, shoes, or clothing at the image edges.',
    'Do not use a close-up, mid-shot, waist-up, knee-up, or tightly framed composition.',
    'If needed, make the subject slightly smaller in frame to preserve full-body visibility.',
    'Use a plain white background.',
    'The person should look happy.',
    'The image must not contain any nudity.',
    'The person must not be displaying any offensive hand gestures.',
    'Preserve garment colors, visible materials, textures, and overall design details from the supplied items.',
    'Do not invent different garment designs or add extra clothing items that were not provided.',
    '',
    'Use these garment references:',
    ...itemLines
  ].join('\n');
}
