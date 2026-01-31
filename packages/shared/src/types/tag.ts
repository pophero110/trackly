/**
 * Tag type definitions
 */

export type TagType =
  | 'Habit'
  | 'Task'
  | 'Mood'
  | 'Node'
  | 'Event'
  | 'Idea'
  | 'Book'
  | 'Article'
  | 'Paper'
  | 'Project'
  | 'Concept'
  | 'Decision'
  | 'Communication'
  | 'Exercise'
  | 'Metric'
  | 'Activity'
  | 'Goal'
  | 'Plan';

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
  updatedAt?: string;
}

export interface TagFormData {
  name: string;
  type: TagType;
  categories?: string;
}
