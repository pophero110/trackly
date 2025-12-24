/**
 * Entity type definitions
 */

export type EntityType =
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
  updatedAt?: string;
}

export interface EntityFormData {
  name: string;
  type: EntityType;
  categories?: string;
}
