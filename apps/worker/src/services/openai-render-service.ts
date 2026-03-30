import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Item, RenderMode, Workspace } from '@mvp/shared';
import OpenAI from 'openai';
import type { ResponseInputContent } from 'openai/resources/responses/responses';
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

export async function generateRenderPreview(params: {
  workspace: Workspace;
  items: Item[];
  renderMode: RenderMode;
}): Promise<GeneratedRenderResult> {
  const content: ResponseInputContent[] = [
    {
      type: 'input_text',
      text: `${buildRenderPrompt(params.workspace, params.items)}\nRequested quality mode: ${params.renderMode}.`
    }
  ];

  for (const item of params.items) {
    if (!item.storedImagePath) {
      throw new Error(`Item ${item.id} is missing storedImagePath`);
    }

    const bytes = await readFile(item.storedImagePath);
    content.push({
      type: 'input_image',
      detail: 'high',
      image_url: `data:${getMimeType(item.storedImagePath)};base64,${bytes.toString('base64')}`
    });
  }

  const response = await getOpenAIClient().responses.create({
    model: 'gpt-4.1-mini',
    input: [
      {
        role: 'user',
        content
      }
    ],
    tools: [
      {
        type: 'image_generation',
        model: getOpenAIImageModel(),
        input_fidelity: 'high',
        size: '1024x1024',
        quality: params.renderMode === 'high_quality' ? 'high' : 'medium',
        output_format: 'png'
      }
    ],
    tool_choice: 'required'
  });

  const imageOutput = (response.output as Array<{ type: string; result?: string; revised_prompt?: string }>).find(
    (entry) => entry.type === 'image_generation_call' && typeof entry.result === 'string'
  );

  if (!imageOutput?.result) {
    throw new Error('OpenAI response did not include generated image data');
  }

  return {
    imageBase64: imageOutput.result,
    revisedPrompt: imageOutput.revised_prompt ?? null
  };
}
