import type { IEntity, IEntry, AuthResponse, PaginatedEntriesResponse } from '@trackly/shared';

/**
 * API configuration
 * Uses Railway production URL by default
 * Can be overridden by setting window.TRACKLY_API_URL
 */
const API_BASE_URL = (window as any).TRACKLY_API_URL || 'https://trackly-production.up.railway.app';

/**
 * API Client for making authenticated requests to the backend
 */
export class APIClient {
  private static getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private static setAuthToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  private static clearAuthToken(): void {
    localStorage.removeItem('auth_token');
  }

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Unauthorized - clear token and redirect to login
      this.clearAuthToken();
      window.location.href = '/';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null as T;
    }

    return response.json();
  }

  // Authentication
  static async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    this.setAuthToken(response.token);
    return response;
  }

  static async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setAuthToken(response.token);
    return response;
  }

  static logout(): void {
    this.clearAuthToken();
    window.location.href = '/';
  }

  static isAuthenticated(): boolean {
    return this.getAuthToken() !== null;
  }

  // Entities
  static async getEntities(): Promise<IEntity[]> {
    return this.request<IEntity[]>('/api/entities');
  }

  static async getEntity(id: string): Promise<IEntity> {
    return this.request<IEntity>(`/api/entities/${id}`);
  }

  static async createEntity(data: Omit<IEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<IEntity> {
    return this.request<IEntity>('/api/entities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async updateEntity(id: string, data: Partial<IEntity>): Promise<IEntity> {
    return this.request<IEntity>(`/api/entities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  static async deleteEntity(id: string): Promise<void> {
    return this.request<void>(`/api/entities/${id}`, {
      method: 'DELETE',
    });
  }

  // Entries
  static async getEntries(params?: {
    entityId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    includeArchived?: boolean;
    limit?: number;
    after?: string;
    afterId?: string;
  }): Promise<PaginatedEntriesResponse> {
    const queryParams = new URLSearchParams();
    if (params?.entityId) queryParams.set('entityId', params.entityId);
    if (params?.sortBy) queryParams.set('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder);
    if (params?.includeArchived) queryParams.set('includeArchived', 'true');
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.after) queryParams.set('after', params.after);
    if (params?.afterId) queryParams.set('afterId', params.afterId);

    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request<PaginatedEntriesResponse>(`/api/entries${query}`);
  }

  static async getEntry(id: string): Promise<IEntry> {
    return this.request<IEntry>(`/api/entries/${id}`);
  }

  static async createEntry(data: Omit<IEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<IEntry> {
    return this.request<IEntry>('/api/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async updateEntry(id: string, data: Partial<IEntry>, options?: { keepalive?: boolean }): Promise<IEntry> {
    return this.request<IEntry>(`/api/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      keepalive: options?.keepalive,
    });
  }

  static async deleteEntry(id: string): Promise<void> {
    return this.request<void>(`/api/entries/${id}`, {
      method: 'DELETE',
    });
  }

  static async archiveEntry(id: string, isArchived: boolean = true): Promise<IEntry> {
    return this.request<IEntry>(`/api/entries/${id}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ isArchived }),
    });
  }
}
