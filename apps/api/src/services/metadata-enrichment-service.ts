import type { Prisma } from '@prisma/client';
import type { MetadataExtractionInput } from './metadata-extraction-service.js';
import { getItemById, updateItemById } from '../repositories/item-repository.js';
import {
  extractMetadata,
  mergeExtractedMetadata
} from './metadata-extraction-service.js';

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

async function enrichItemMetadata(itemId: string, input: MetadataExtractionInput): Promise<void> {
  const existing = await getItemById(itemId);
  if (!existing) {
    return;
  }

  const extracted = extractMetadata(input, { includeDeepSignals: true });
  const mergedMetadataJson = mergeExtractedMetadata(
    (existing.metadataJson ?? {}) as Record<string, unknown>,
    extracted.metadataJson
  );

  const data: Prisma.ItemUpdateInput = {
    metadataJson: mergedMetadataJson as Prisma.InputJsonValue
  };

  if (isBlank(existing.title) && extracted.title) {
    data.title = extracted.title;
  }

  if (isBlank(existing.merchant) && extracted.merchant) {
    data.merchant = extracted.merchant;
  }

  if (isBlank(existing.brand) && extracted.brand) {
    data.brand = extracted.brand;
  }

  if (!existing.price && extracted.price) {
    data.price = extracted.price;
  }

  if (isBlank(existing.currency) && extracted.currency) {
    data.currency = extracted.currency;
  }

  if (isBlank(existing.slotType) && extracted.slotType) {
    data.slotType = extracted.slotType;
  }

  await updateItemById(itemId, data);
}

export function queueItemMetadataEnrichment(itemId: string, input: MetadataExtractionInput): void {
  setTimeout(() => {
    void enrichItemMetadata(itemId, input).catch((error) => {
      console.error(`[metadata-enrichment] failed to enrich item ${itemId}`, error);
    });
  }, 0);
}
