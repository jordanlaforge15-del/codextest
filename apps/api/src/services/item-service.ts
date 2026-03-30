import type { Prisma } from '@prisma/client';
import type { Item } from '@mvp/shared';
import { HttpError } from '../errors/http-error.js';
import {
  createItem,
  deleteItemById,
  getItemById,
  listItemsByWorkspace,
  updateItemById
} from '../repositories/item-repository.js';
import { getWorkspaceById } from '../repositories/workspace-repository.js';
import { ingestImageFromUrl } from './image-ingestion-service.js';

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

export async function resolveStoredImagePath(imageUrl?: string | null): Promise<string | null> {
  if (!imageUrl) {
    return null;
  }

  try {
    const ingestionResult = await ingestImageFromUrl(imageUrl);
    return ingestionResult.storedImagePath;
  } catch (error) {
    console.error(`Failed to ingest image from ${imageUrl}`, error);
    return null;
  }
}

export async function createItemService(
  workspaceId: string,
  input: Partial<Item>
): Promise<Item> {
  await assertWorkspaceExists(workspaceId);

  const storedImagePath =
    input.storedImagePath ?? (await resolveStoredImagePath(input.imageUrl ?? null));

  const item = await createItem({
    workspaceId,
    sourceUrl: input.sourceUrl ?? null,
    pageUrl: input.pageUrl ?? null,
    imageUrl: input.imageUrl ?? null,
    storedImagePath,
    title: input.title ?? null,
    brand: input.brand ?? null,
    merchant: input.merchant ?? null,
    price: input.price ?? null,
    currency: input.currency ?? null,
    slotType: input.slotType ?? null,
    role: input.role ?? 'candidate',
    metadataJson: (input.metadataJson ?? {}) as Prisma.InputJsonValue
  });

  return toItemResponse(item);
}

export async function listItemsService(workspaceId: string): Promise<Item[]> {
  await assertWorkspaceExists(workspaceId);
  const items = await listItemsByWorkspace(workspaceId);
  return items.map(toItemResponse);
}

export async function updateItemService(
  workspaceId: string,
  itemId: string,
  input: Partial<Item>
): Promise<Item> {
  await assertWorkspaceExists(workspaceId);

  const existing = await getItemById(itemId);
  if (!existing || existing.workspaceId !== workspaceId) {
    throw new HttpError(404, 'Item not found in workspace');
  }

  const item = await updateItemById(itemId, {
    sourceUrl: input.sourceUrl,
    pageUrl: input.pageUrl,
    imageUrl: input.imageUrl,
    storedImagePath: input.storedImagePath,
    title: input.title,
    brand: input.brand,
    merchant: input.merchant,
    price: input.price,
    currency: input.currency,
    slotType: input.slotType,
    role: input.role,
    metadataJson: input.metadataJson as Prisma.InputJsonValue | undefined
  });

  return toItemResponse(item);
}

export async function deleteItemService(workspaceId: string, itemId: string): Promise<void> {
  await assertWorkspaceExists(workspaceId);

  const existing = await getItemById(itemId);
  if (!existing || existing.workspaceId !== workspaceId) {
    throw new HttpError(404, 'Item not found in workspace');
  }

  await deleteItemById(itemId);
}
