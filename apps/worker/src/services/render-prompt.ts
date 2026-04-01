import type { Item, Workspace } from '@mvp/shared';

export function buildRenderPrompt(workspace: Workspace, items: Item[]): string {
  void workspace;
  void items;
  return 'Create an image of a person wearing these two pieces of clothing.';
}
