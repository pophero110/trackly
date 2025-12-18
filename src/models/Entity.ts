import { generateId } from '../utils/helpers.js';
import { IEntity, EntityType, EntityFormData } from '../types/index.js';

/**
 * Entity model representing a trackable item
 */
export class Entity implements IEntity {
  id: string;
  name: string;
  type: EntityType;
  categories: string[];
  createdAt: string;

  constructor(data: Partial<IEntity> & { name: string; type: EntityType }) {
    this.id = data.id || generateId();
    this.name = data.name;
    this.type = data.type;
    this.categories = data.categories || [];
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  static fromFormData(formData: EntityFormData): Entity {
    return new Entity({
      name: formData.name.trim(),
      type: formData.type,
      categories: formData.categories
        ? formData.categories.split(',').map(c => c.trim()).filter(c => c)
        : []
    });
  }

  validate(): string[] {
    const errors: string[] = [];

    if (!this.name) {
      errors.push('Name is required');
    }

    const validTypes: EntityType[] = ['Habit', 'Task', 'Expense', 'Mood', 'Node'];
    if (!this.type || !validTypes.includes(this.type)) {
      errors.push('Valid type is required');
    }

    return errors;
  }

  toJSON(): IEntity {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      categories: this.categories,
      createdAt: this.createdAt
    };
  }
}
