/**
 * Type definitions for Trackly
 */

export type EntityType = 'Habit' | 'Task' | 'Expense' | 'Mood' | 'Node';

export interface IEntity {
  id: string;
  name: string;
  type: EntityType;
  categories: string[];
  createdAt: string;
}

export interface IEntry {
  id: string;
  entityId: string;
  entityName: string;
  timestamp: string;
  notes: string;
  createdAt: string;
}

export interface EntityFormData {
  name: string;
  type: EntityType;
  categories?: string;
}

export interface EntryFormData {
  timestamp: string;
  notes?: string;
}

export type StoreListener = () => void;
export type Unsubscribe = () => void;
