export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

export function resolveAssetUrl(
  apiBaseUrl: string,
  relativeOrAbsolute: string | null | undefined
): string | null {
  if (!relativeOrAbsolute) {
    return null;
  }

  if (/^https?:\/\//.test(relativeOrAbsolute)) {
    return relativeOrAbsolute;
  }

  return `${normalizeBaseUrl(apiBaseUrl)}${relativeOrAbsolute}`;
}

import type { Render } from '@mvp/shared';

export function getPreferredWorkspaceThumbnail(renders: Render[]): string | null {
  const upVotedRender = renders.find((render) => render.currentVote === 'up' && render.outputImageUrl);
  if (upVotedRender) {
    return upVotedRender.outputImageUrl;
  }

  return null;
}
