/**
 * Entry type definitions
 */

export interface IEntry {
  id: string;
  entityId: string;
  entityName: string;
  title: string;  // Mandatory title for the entry
  timestamp: string;
  value?: string | number | boolean;
  valueDisplay?: string;  // For storing fetched titles or display text
  notes: string;
  tags?: string[];  // Extracted hashtags (for API responses)
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
