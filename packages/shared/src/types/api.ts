/**
 * API request and response type definitions
 */

import { ITag } from './tag';
import { IEntry } from './entry';

// Authentication
export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name?: string;
  };
  token: string;
}

// API Error Response
export interface ApiError {
  error: string;
  details?: unknown;
}

// Tag API
export interface CreateTagRequest {
  name: string;
  type: string;
  categories: string[];
  valueType?: string;
  options?: unknown;
  properties?: unknown;
}

export interface UpdateTagRequest {
  name?: string;
  type?: string;
  categories?: string[];
  valueType?: string;
  options?: unknown;
  properties?: unknown;
}

export type TagListResponse = ITag[];
export type TagResponse = ITag;

// Entry API
export interface CreateEntryRequest {
  tagIds: string[];  // Array of tag IDs for many-to-many relationship
  title: string;
  timestamp: string;
  notes?: string;
}

export interface UpdateEntryRequest {
  tagIds?: string[];  // Optional: replace all tags with these
  title?: string;
  timestamp?: string;
  notes?: string;
}

export type EntryListResponse = IEntry[];
export type EntryResponse = IEntry;

// Pagination
export interface PaginationCursor {
  after: string;      // Sort field value (ISO timestamp or string)
  afterId: string;    // Entry ID for tie-breaking
}

export interface PaginatedEntriesResponse {
  entries: IEntry[];
  pagination: {
    hasMore: boolean;
    nextCursor: PaginationCursor | null;
  };
}

export interface GetEntriesParams {
  tagIds?: string[];  // Filter by multiple tag IDs (entries must have at least one)
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
  limit?: number;
  after?: string;
  afterId?: string;
}

// Sync API
export interface SyncRequest {
  tags: ITag[];
  entries: IEntry[];
}

export interface SyncResponse {
  success: boolean;
  imported: {
    tags: number;
    entries: number;
  };
}

export interface SyncStatusResponse {
  lastSync: string | null;
}
