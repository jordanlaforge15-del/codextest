import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getRenderOutputDirectory } from './render-config.js';

export async function saveGeneratedRender(renderId: string, imageBase64: string): Promise<string> {
  const outputDir = getRenderOutputDirectory();
  await mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${renderId}.png`);
  await writeFile(outputPath, Buffer.from(imageBase64, 'base64'));
  return outputPath;
}
