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
