import { Storage } from '../utils/storage.js';
import { Entity } from '../models/Entity.js';
import { Entry } from '../models/Entry.js';
import { IEntity, IEntry, StoreListener, Unsubscribe } from '../types/index.js';

/**
 * Central state management store
 */
export class Store {
    private entities: Entity[];
    private entries: Entry[];
    private listeners: StoreListener[];
    private selectedEntityId: string | null;

    constructor() {
        this.entities = [];
        this.entries = [];
        this.listeners = [];
        this.selectedEntityId = null;
        this.loadData();
    }

    // Load data from localStorage
    private loadData(): void {
        const entitiesData = Storage.load<IEntity[]>('entities') || [];
        const entriesData = Storage.load<IEntry[]>('entries') || [];

        this.entities = entitiesData.map(data => new Entity(data));
        this.entries = entriesData.map(data => new Entry(data));
    }

    // Save data to localStorage
    private saveData(): void {
        Storage.save('entities', this.entities.map(e => e.toJSON()));
        Storage.save('entries', this.entries.map(e => e.toJSON()));
    }

    // Subscribe to state changes
    subscribe(listener: StoreListener): Unsubscribe {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    // Notify all listeners of state change
    private notify(): void {
        this.listeners.forEach(listener => listener());
    }

    // Entity operations
    getEntities(): Entity[] {
        return [...this.entities];
    }

    getEntityById(id: string): Entity | undefined {
        return this.entities.find(e => e.id === id);
    }

    addEntity(entity: Entity): void {
        const errors = entity.validate();
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }

        if (this.entities.some(e => e.name === entity.name)) {
            throw new Error('An entity with this name already exists');
        }

        this.entities.push(entity);
        this.saveData();
        this.notify();
    }

    updateEntity(id: string, updates: Partial<IEntity>): void {
        const index = this.entities.findIndex(e => e.id === id);
        if (index === -1) {
            throw new Error('Entity not found');
        }

        const currentEntity = this.entities[index];
        this.entities[index] = new Entity({ ...currentEntity, ...updates });

        const errors = this.entities[index].validate();
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }

        this.saveData();
        this.notify();
    }

    deleteEntity(id: string): void {
        this.entities = this.entities.filter(e => e.id !== id);
        this.entries = this.entries.filter(e => e.entityId !== id);
        this.saveData();
        this.notify();
    }

    // Entry operations
    getEntries(): Entry[] {
        return [...this.entries];
    }

    getEntriesByEntityId(entityId: string): Entry[] {
        return this.entries.filter(e => e.entityId === entityId);
    }

    addEntry(entry: Entry): void {
        const errors = entry.validate();
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }

        this.entries.push(entry);
        this.saveData();
        this.notify();
    }

    updateEntry(id: string, updates: Partial<IEntry>): void {
        const index = this.entries.findIndex(e => e.id === id);
        if (index === -1) {
            throw new Error('Entry not found');
        }

        const currentEntry = this.entries[index];
        this.entries[index] = new Entry({ ...currentEntry, ...updates });

        const errors = this.entries[index].validate();
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }

        this.saveData();
        this.notify();
    }

    deleteEntry(id: string): void {
        this.entries = this.entries.filter(e => e.id !== id);
        this.saveData();
        this.notify();
    }

    // Selected entity operations
    getSelectedEntityId(): string | null {
        return this.selectedEntityId;
    }

    setSelectedEntityId(entityId: string | null): void {
        this.selectedEntityId = entityId;
        this.notify();
    }
}
