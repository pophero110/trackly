import { generateId } from '../utils/helpers.js';
import { IEntry, EntryFormData } from '../types/index.js';
import { Entity } from './Entity.js';

/**
 * Entry model representing a logged measurement for an Entity
 */
export class Entry implements IEntry {
    id: string;
    entityId: string;
    entityName: string;
    timestamp: string;
    value?: string | number | boolean;
    valueDisplay?: string;
    notes: string;
    images?: string[];
    propertyValues?: Record<string, string | number | boolean>;
    propertyValueDisplays?: Record<string, string>;
    createdAt: string;

    constructor(data: Partial<IEntry> & { entityId: string; entityName: string; timestamp: string }) {
        this.id = data.id || generateId();
        this.entityId = data.entityId;
        this.entityName = data.entityName;
        this.timestamp = data.timestamp;
        this.value = data.value;
        this.valueDisplay = data.valueDisplay;
        this.notes = data.notes || '';
        this.images = data.images || [];
        this.propertyValues = data.propertyValues || {};
        this.propertyValueDisplays = data.propertyValueDisplays || {};
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    static fromFormData(formData: EntryFormData, entity: Entity): Entry {
        return new Entry({
            entityId: entity.id,
            entityName: entity.name,
            timestamp: new Date(formData.timestamp).toISOString(),
            value: formData.value,
            valueDisplay: formData.valueDisplay,
            notes: formData.notes?.trim() || ''
        });
    }

    validate(): string[] {
        const errors: string[] = [];

        if (!this.entityId) {
            errors.push('Entity ID is required');
        }

        if (!this.timestamp) {
            errors.push('Timestamp is required');
        }

        return errors;
    }

    toJSON(): IEntry {
        return {
            id: this.id,
            entityId: this.entityId,
            entityName: this.entityName,
            timestamp: this.timestamp,
            value: this.value,
            valueDisplay: this.valueDisplay,
            notes: this.notes,
            images: this.images,
            propertyValues: this.propertyValues,
            propertyValueDisplays: this.propertyValueDisplays,
            createdAt: this.createdAt
        };
    }
}
