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
  images?: string[];  // Array of base64 image data URLs
  links?: string[];  // Array of URLs for context/reference
  linkTitles?: Record<string, string>;  // URL to page title mappings
  entryReferences?: string[];  // Array of entry IDs that this entry references
  propertyValues?: Record<string, string | number | boolean>;  // Custom property values by property ID
  propertyValueDisplays?: Record<string, string>;  // Display text for property values (e.g., URL titles)
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
