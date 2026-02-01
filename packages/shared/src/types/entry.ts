/**
 * Entry type definitions
 */

/**
 * Represents a tag associated with an entry (many-to-many relationship)
 */
export interface IEntryTag {
  id: string;
  tagId: string;
  tagName: string;
  createdAt: string;
}

export interface IEntry {
  id: string;
  tags: IEntryTag[];  // Many-to-many relationship with tags
  title: string;  // Mandatory title for the entry
  timestamp: string;
  value?: string | number | boolean;
  valueDisplay?: string;  // For storing fetched titles or display text
  notes: string;
  hashtags?: string[];  // Extracted hashtags (for API responses)
  latitude?: number;  // Location latitude
  longitude?: number;  // Location longitude
  locationName?: string;  // Optional location name (e.g., "San Francisco, CA")
  isArchived?: boolean;  // Whether the entry is archived
  createdAt: string;
  updatedAt?: string;
}

export interface EntryFormData {
  title: string;
  timestamp: string;
  value?: string | number | boolean;
  valueDisplay?: string;
  notes?: string;
}
