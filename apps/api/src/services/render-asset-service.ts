import path from 'node:path';

const DEFAULT_RENDER_OUTPUT_DIR = path.join('..', '..', 'storage', 'renders');

export function getRenderOutputDirectory(): string {
  return path.resolve(process.cwd(), process.env.RENDER_OUTPUT_DIR ?? DEFAULT_RENDER_OUTPUT_DIR);
}

export function toRenderOutputUrl(outputImagePath: string | null): string | null {
  if (!outputImagePath) {
    return null;
  }

  return `/assets/renders/${encodeURIComponent(path.basename(outputImagePath))}`;
}
