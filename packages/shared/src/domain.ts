export type DomainType = 'outfit' | 'room' | 'beauty' | 'other';

export interface Workspace {
  id: string;
  title: string;
  intentionText: string | null;
  domainType: DomainType;
  createdAt: string;
  updatedAt: string;
}

export type ItemRole = 'fixed' | 'candidate';

export interface Item {
  id: string;
  workspaceId: string;
  sourceUrl: string | null;
  pageUrl: string | null;
  imageUrl: string | null;
  storedImagePath: string | null;
  title: string | null;
  brand: string | null;
  merchant: string | null;
  price: string | null;
  currency: string | null;
  slotType: string | null;
  role: ItemRole;
  metadataJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type RenderStatus = 'queued' | 'processing' | 'complete' | 'failed';
export type RenderMode = 'preview' | 'high_quality';

export interface Render {
  id: string;
  workspaceId: string;
  status: RenderStatus;
  renderMode: RenderMode;
  selectedItemIds: string[];
  recommendationText: string | null;
  recommendationLabel: string | null;
  outputImagePath: string | null;
  outputImageUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FeedbackRating = 'yes' | 'no' | 'maybe';

export interface Feedback {
  id: string;
  workspaceId: string;
  renderId: string;
  rating: FeedbackRating;
  note: string | null;
  createdAt: string;
}

export interface CaptureEvent {
  id: string;
  workspaceId: string;
  pageUrl: string;
  imageUrl: string;
  pageTitle: string | null;
  altText: string | null;
  surroundingText: string | null;
  rawPayloadJson: Record<string, unknown>;
  createdAt: string;
}
