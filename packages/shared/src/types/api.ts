/**
 * API request and response type definitions
 */

import { IEntity } from './entity';
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

// Entity API
export interface CreateEntityRequest {
  name: string;
  type: string;
  categories: string[];
  valueType?: string;
  options?: unknown;
  properties?: unknown;
}

export interface UpdateEntityRequest {
  name?: string;
  type?: string;
  categories?: string[];
  valueType?: string;
  options?: unknown;
  properties?: unknown;
}

export type EntityListResponse = IEntity[];
export type EntityResponse = IEntity;

// Entry API
export interface CreateEntryRequest {
  entityId: string;
  timestamp: string;
  value?: string | number | boolean;
  valueDisplay?: string;
  notes?: string;
  images?: string[];
  propertyValues?: Record<string, string | number | boolean>;
  propertyValueDisplays?: Record<string, string>;
}

export interface UpdateEntryRequest {
  timestamp?: string;
  value?: string | number | boolean;
  valueDisplay?: string;
  notes?: string;
  images?: string[];
  propertyValues?: Record<string, string | number | boolean>;
  propertyValueDisplays?: Record<string, string>;
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
  entityId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
  limit?: number;
  after?: string;
  afterId?: string;
}

// Sync API
export interface SyncRequest {
  entities: IEntity[];
  entries: IEntry[];
}

export interface SyncResponse {
  success: boolean;
  imported: {
    entities: number;
    entries: number;
  };
}

export interface SyncStatusResponse {
  lastSync: string | null;
}
