import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Item, RenderMode, Workspace } from '@mvp/shared';
import OpenAI, { toFile } from 'openai';
import { buildRenderPrompt } from './render-prompt.js';
import { getOpenAIBaseUrl, getOpenAIImageModel, getOpenAIKey } from './render-config.js';

function getMimeType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'image/png';
  }
}

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: getOpenAIKey(),
      baseURL: getOpenAIBaseUrl()
    });
  }

  return openaiClient;
}

export interface GeneratedRenderResult {
  imageBase64: string;
  revisedPrompt: string | null;
}

function getRenderQuality(renderMode: RenderMode): 'high' | 'medium' {
  switch (renderMode) {
    case 'high_quality':
      return 'high';
    case 'preview':
      return 'medium';
    default:
      throw new Error(`Unsupported render mode: ${renderMode satisfies never}`);
  }
}

export async function generateRenderPreview(params: {
  workspace: Workspace;
  items: Item[];
  renderMode: RenderMode;
  personImagePath?: string | null;
}): Promise<GeneratedRenderResult> {
  if (params.items.length < 2) {
    throw new Error('Render generation requires at least two input item images');
  }

  const uploadImages = [];
  if (params.personImagePath) {
    const personBytes = await readFile(params.personImagePath);
    uploadImages.push(
      await toFile(personBytes, path.basename(params.personImagePath), {
        type: getMimeType(params.personImagePath)
      })
    );
  }

  for (const item of params.items) {
    if (!item.storedImagePath) {
      throw new Error(`Item ${item.id} is missing storedImagePath`);
    }

    const bytes = await readFile(item.storedImagePath);
    uploadImages.push(
      await toFile(bytes, path.basename(item.storedImagePath), {
        type: getMimeType(item.storedImagePath)
      })
    );
  }

  const prompt = `${buildRenderPrompt(params.workspace, params.items, {
    usePersonReference: Boolean(params.personImagePath)
  })}\nRequested quality mode: ${params.renderMode}.`;

  console.log('[render-worker] sending prompt to OpenAI', {
    workspaceId: params.workspace.id,
    workspaceTitle: params.workspace.title,
    renderMode: params.renderMode,
    personImagePath: params.personImagePath ?? null,
    itemIds: params.items.map((item) => item.id),
    prompt
  });

  const response = await getOpenAIClient().images.edit({
    model: getOpenAIImageModel(),
    image: uploadImages,
    prompt,
    input_fidelity: 'high',
    size: '1024x1536',
    quality: getRenderQuality(params.renderMode),
    output_format: 'png'
  });

  const imageOutput = response.data?.find((entry) => typeof entry.b64_json === 'string');

  if (!imageOutput?.b64_json) {
    throw new Error('OpenAI image edit response did not include generated image data');
  }

  console.log('[render-worker] OpenAI revised prompt', {
    workspaceId: params.workspace.id,
    revisedPrompt: imageOutput.revised_prompt ?? null
  });

  return {
    imageBase64: imageOutput.b64_json,
    revisedPrompt: imageOutput.revised_prompt ?? null
  };
}
