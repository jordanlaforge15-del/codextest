import type { Item, Workspace } from '@mvp/shared';

export interface ApiResponse<T> {
  data: T;
}

export interface WorkspaceListResponse extends ApiResponse<Workspace[]> {}
export interface WorkspaceResponse extends ApiResponse<Workspace> {}
export interface ItemListResponse extends ApiResponse<Item[]> {}
export interface ItemResponse extends ApiResponse<Item> {}
