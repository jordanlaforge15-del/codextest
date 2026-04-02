import type { Item, Render, Workspace } from '@mvp/shared';

export interface ApiResponse<T> {
  data: T;
}

export interface WorkspaceListResponse extends ApiResponse<Workspace[]> {}
export interface WorkspaceResponse extends ApiResponse<Workspace> {}
export interface ItemListResponse extends ApiResponse<Item[]> {}
export interface ItemResponse extends ApiResponse<Item> {}
export interface RenderListResponse extends ApiResponse<Render[]> {}
export interface RenderResponse extends ApiResponse<Render> {}
