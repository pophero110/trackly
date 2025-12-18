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
    notes: string;
    createdAt: string;

    constructor(data: Partial<IEntry> & { entityId: string; entityName: string; timestamp: string }) {
        this.id = data.id || generateId();
        this.entityId = data.entityId;
        this.entityName = data.entityName;
        this.timestamp = data.timestamp;
        this.notes = data.notes || '';
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    static fromFormData(formData: EntryFormData, entity: Entity): Entry {
        return new Entry({
            entityId: entity.id,
            entityName: entity.name,
            timestamp: new Date(formData.timestamp).toISOString(),
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
            notes: this.notes,
            createdAt: this.createdAt
        };
    }
}
