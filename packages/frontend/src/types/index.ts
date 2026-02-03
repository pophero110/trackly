/**
 * Type definitions for Trackly
 */

// Core tag types (7 types based on tracking behavior)
export type TagType = 'Habit' | 'Metric' | 'Task' | 'Note' | 'Event' | 'Resource' | 'Decision';

/**
 * IPO (Input-Process-Output) category for entries
 * - Input: What goes in (calories, sleep, books read, information consumed)
 * - Process: Internal state (mood, HRV, stress, focus, energy levels)
 * - Output: What comes out (tasks completed, code written, creative work)
 */
export type IpoCategory = 'input' | 'process' | 'output';

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

export interface TagProperty {
  id: string;
  name: string;
  valueType: ValueType;
  required?: boolean;
  options?: SelectOption[];  // For 'select' valueType
}

export interface ITag {
  id: string;
  name: string;
  type: TagType;
  categories: string[];
  valueType?: ValueType;
  options?: SelectOption[];  // For 'select' valueType
  properties?: TagProperty[];  // Custom properties
  createdAt: string;
}

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
  latitude?: number;  // Location latitude
  longitude?: number;  // Location longitude
  locationName?: string;  // Optional location name (e.g., "San Francisco, CA")
  ipoCategory?: IpoCategory;  // IPO category (Input, Process, Output)
  isArchived?: boolean;  // Whether the entry is archived
  createdAt: string;
}

export interface TagFormData {
  name: string;
  type: TagType;
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
