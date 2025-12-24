/**
 * Entry type definitions
 */

export interface IEntry {
  id: string;
  entityId: string;
  entityName: string;
  timestamp: string;
  value?: string | number | boolean;
  valueDisplay?: string;  // For storing fetched titles or display text
  notes: string;
  images?: string[];  // Array of base64 image data URLs
  propertyValues?: Record<string, string | number | boolean>;  // Custom property values by property ID
  propertyValueDisplays?: Record<string, string>;  // Display text for property values (e.g., URL titles)
  createdAt: string;
  updatedAt?: string;
}

export interface EntryFormData {
  timestamp: string;
  value?: string | number | boolean;
  valueDisplay?: string;
  notes?: string;
}
