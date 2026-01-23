/**
 * Type definitions for Trackly
 */

// Core entity types (7 types based on tracking behavior)
export type EntityType = 'Habit' | 'Metric' | 'Task' | 'Note' | 'Event' | 'Resource' | 'Decision';

export type ValueType =
  // Text-based inputs
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  // Number inputs
  | 'number'
  | 'range'
  // Date/Time inputs
  | 'date'
  | 'time'
  | 'datetime-local'
  | 'month'
  | 'week'
  // Boolean/Selection
  | 'checkbox'
  | 'select'
  // Media (URL-based)
  | 'image'
  | 'audio'
  | 'video'
  // Color
  | 'color'
  // Custom types (using number inputs with specific constraints)
  | 'duration'
  | 'rating'
  // Legacy alias
  | 'hyperlink';

export interface SelectOption {
  value: string;
  label: string;
}

export interface EntityProperty {
  id: string;
  name: string;
  valueType: ValueType;
  required?: boolean;
  options?: SelectOption[];  // For 'select' valueType
}

export interface IEntity {
  id: string;
  name: string;
  type: EntityType;
  categories: string[];
  valueType?: ValueType;
  options?: SelectOption[];  // For 'select' valueType
  properties?: EntityProperty[];  // Custom properties
  createdAt: string;
}

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
  propertyValues?: Record<string, string | number | boolean>;  // Custom property values by property ID
  propertyValueDisplays?: Record<string, string>;  // Display text for property values (e.g., URL titles)
  latitude?: number;  // Location latitude
  longitude?: number;  // Location longitude
  locationName?: string;  // Optional location name (e.g., "San Francisco, CA")
  links?: string[];  // Array of URLs for context/reference
  isArchived?: boolean;  // Whether the entry is archived
  createdAt: string;
}

export interface EntityFormData {
  name: string;
  type: EntityType;
  categories?: string;
}

export interface EntryFormData {
  title: string;
  timestamp: string;
  value?: string | number | boolean;
  valueDisplay?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
}

export type StoreListener = () => void;
export type Unsubscribe = () => void;
