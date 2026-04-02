import type { Prisma } from '@prisma/client';
import type { CaptureEvent, Item } from '@mvp/shared';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../errors/http-error.js';
import { getWorkspaceById } from '../repositories/workspace-repository.js';
import {
  buildNormalizedItemFields,
  extractMetadata,
  mergeExtractedMetadata
} from './metadata-extraction-service.js';
import { queueItemMetadataEnrichment } from './metadata-enrichment-service.js';
import { resolveStoredImagePath } from './item-service.js';

export interface CreateCaptureInput {
  page_url: string;
  image_url: string;
  page_title?: string;
  alt_text?: string | null;
  surrounding_text?: string | null;
  raw_payload_json?: Record<string, unknown>;
}

export interface CaptureResult {
  capture: CaptureEvent;
  item: Item;
}

function toCaptureResponse(capture: {
  id: string;
  workspaceId: string;
  pageUrl: string;
  imageUrl: string;
  pageTitle: string | null;
  altText: string | null;
  surroundingText: string | null;
  rawPayloadJson: unknown;
  createdAt: Date;
}): CaptureEvent {
  return {
    id: capture.id,
    workspaceId: capture.workspaceId,
    pageUrl: capture.pageUrl,
    imageUrl: capture.imageUrl,
    pageTitle: capture.pageTitle,
    altText: capture.altText,
    surroundingText: capture.surroundingText,
    rawPayloadJson: (capture.rawPayloadJson ?? {}) as Record<string, unknown>,
    createdAt: capture.createdAt.toISOString()
  };
}

function toItemResponse(item: {
  id: string;
  workspaceId: string;
  sourceUrl: string | null;
  pageUrl: string | null;
  imageUrl: string | null;
  storedImagePath: string | null;
  title: string | null;
  brand: string | null;
  merchant: string | null;
  price: unknown;
  currency: string | null;
  slotType: string | null;
  role: 'fixed' | 'candidate';
  metadataJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}): Item {
  return {
    id: item.id,
    workspaceId: item.workspaceId,
    sourceUrl: item.sourceUrl,
    pageUrl: item.pageUrl,
    imageUrl: item.imageUrl,
    storedImagePath: item.storedImagePath,
    title: item.title,
    brand: item.brand,
    merchant: item.merchant,
    price: item.price ? String(item.price) : null,
    currency: item.currency,
    slotType: item.slotType,
    role: item.role,
    metadataJson: (item.metadataJson ?? {}) as Record<string, unknown>,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

async function assertWorkspaceExists(workspaceId: string): Promise<void> {
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) {
    throw new HttpError(404, 'Workspace not found');
  }
}

export async function createCaptureService(
  workspaceId: string,
  input: CreateCaptureInput
): Promise<CaptureResult> {
  await assertWorkspaceExists(workspaceId);
  const storedImagePath = await resolveStoredImagePath(input.image_url);
  const extracted = (() => {
    try {
      return extractMetadata({
        pageUrl: input.page_url,
        imageUrl: input.image_url,
        pageTitle: input.page_title,
        altText: input.alt_text,
        surroundingText: input.surrounding_text,
        rawPayloadJson: input.raw_payload_json
      });
    } catch (error) {
      console.error('Failed to extract capture metadata', error);
      return extractMetadata({});
    }
  })();
  const normalizedFields = buildNormalizedItemFields(
    {
      metadataJson: {
        captureContext: {
          altText: input.alt_text ?? null,
          surroundingText: input.surrounding_text ?? null
        }
      }
    },
    extracted
  );

  const result = await prisma.$transaction(async (tx) => {
    const capture = await tx.captureEvent.create({
      data: {
        workspaceId,
        pageUrl: input.page_url,
        imageUrl: input.image_url,
        pageTitle: input.page_title ?? null,
        altText: input.alt_text ?? null,
        surroundingText: input.surrounding_text ?? null,
        rawPayloadJson: (input.raw_payload_json ?? {}) as Prisma.InputJsonValue
      }
    });

    const item = await tx.item.create({
      data: {
        workspaceId,
        pageUrl: input.page_url,
        imageUrl: input.image_url,
        sourceUrl: input.image_url,
        storedImagePath,
        title: normalizedFields.title ?? input.alt_text ?? input.page_title ?? null,
        merchant: normalizedFields.merchant,
        brand: normalizedFields.brand,
        price: normalizedFields.price,
        currency: normalizedFields.currency,
        slotType: normalizedFields.slotType,
        role: 'candidate',
        metadataJson: mergeExtractedMetadata(normalizedFields.metadataJson, {
          captureEventId: capture.id,
          rawPayloadJson: input.raw_payload_json ?? {}
        }) as Prisma.InputJsonValue
      }
    });

    return { capture, item };
  });

  queueItemMetadataEnrichment(result.item.id, {
    pageUrl: input.page_url,
    imageUrl: input.image_url,
    pageTitle: input.page_title,
    altText: input.alt_text,
    surroundingText: input.surrounding_text,
    rawPayloadJson: input.raw_payload_json
  });

  return {
    capture: toCaptureResponse(result.capture),
    item: toItemResponse(result.item)
  };
}
