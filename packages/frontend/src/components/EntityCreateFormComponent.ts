import { WebComponent } from './WebComponent.js';
import { Entity } from '../models/Entity.js';
import { EntityFormData, EntityType, EntityProperty, ValueType, SelectOption } from '../types/index.js';
import { URLStateManager } from '../utils/urlState.js';
import { generateId } from '../utils/helpers.js';
import { toast } from '../utils/toast.js';

/**
 * EntityCreateForm Web Component for creating new entities
 * Handles both regular create and clone modes
 */
export class EntityCreateFormComponent extends WebComponent {
    private properties: EntityProperty[] = [];
    private hasUnsavedChanges: boolean = false;

    connectedCallback(): void {
        // Don't auto-render, wait for setCreateMode() or setCloneMode()
    }

    // For regular create mode
    setCreateMode(): void {
        this.properties = [];
        this.hasUnsavedChanges = false;
        this.render();
        this.attachEventListeners();
    }

    // For clone mode - provide entity to clone
    setCloneMode(sourceEntity: Entity): void {
        // Clone properties from source entity
        this.properties = sourceEntity.properties ? sourceEntity.properties.map(prop => ({
            ...prop,
            id: generateId() // Generate new IDs for cloned properties
        })) : [];
        this.hasUnsavedChanges = false;
        this.render();
        this.attachEventListeners();

        // Pre-fill form with source entity data
        const nameInput = this.querySelector('#entity-name') as HTMLInputElement;
        const typeSelect = this.querySelector('#entity-type') as HTMLSelectElement;

        if (nameInput) {
            nameInput.value = `${sourceEntity.name} (Copy)`;
        }
        if (typeSelect) {
            typeSelect.value = sourceEntity.type;
        }
    }

    render(): void {
        this.innerHTML = `
            <form id="entity-create-form">
                <div class="form-group">
                    <label for="entity-name">Name *</label>
                    <input type="text" id="entity-name" value="" placeholder="e.g., Morning Run" required>
                </div>

                <div class="form-group">
                    <label for="entity-type">Type *</label>
                    <select id="entity-type" required>
                        <option value="">Select type...</option>
                        <option value="Habit">Habit - Binary yes/no tracking</option>
                        <option value="Metric">Metric - Numeric measurements</option>
                        <option value="Task">Task - Status-based workflow</option>
                        <option value="Note">Note - Freeform text logging</option>
                        <option value="Event">Event - Time-based occurrences</option>
                        <option value="Resource">Resource - External references (URLs)</option>
                        <option value="Decision">Decision - Choice tracking</option>
                    </select>
                    <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px; display: block;">Choose based on how you want to track this entity</small>
                </div>

                <div class="form-group">
                    <label>Custom Properties</label>
                    <div id="properties-list">
                        ${this.renderPropertiesList()}
                    </div>
                    <button type="button" class="btn btn-secondary" id="add-property-btn">+ Add Property</button>
                </div>

                <button type="submit" class="btn btn-primary">Create Entity</button>
            </form>
        `;
    }

    private renderPropertiesList(): string {
        if (this.properties.length === 0) {
            return '';
        }

        const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

        return this.properties.map((prop, index) => `
            <div class="property-item" data-index="${index}">
                <div class="property-info">
                    <strong>${capitalizeFirstLetter(prop.name)}</strong>
                    <span class="property-type">${prop.valueType}</span>
                    ${prop.required ? '<span class="property-required">Required</span>' : ''}
                </div>
                <button type="button" class="btn-remove-property" data-index="${index}">Remove</button>
            </div>
        `).join('');
    }

    protected attachEventListeners(): void {
        const form = this.querySelector('#entity-create-form') as HTMLFormElement;
        const addPropertyBtn = this.querySelector('#add-property-btn') as HTMLButtonElement;

        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));

            // Track form changes
            form.addEventListener('input', () => {
                this.hasUnsavedChanges = true;
            });
            form.addEventListener('change', () => {
                this.hasUnsavedChanges = true;
            });
        }

        if (addPropertyBtn) {
            addPropertyBtn.addEventListener('click', () => this.handleAddProperty());
        }

        // Attach remove handlers for properties
        this.querySelectorAll('.btn-remove-property').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt((e.target as HTMLElement).dataset.index || '0');
                this.handleRemoveProperty(index);
            });
        });
    }

    private handleAddProperty(): void {
        // Helper function to capitalize first letter
        const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

        // Create a modal for adding property
        const modal = document.createElement('div');
        modal.className = 'property-modal';
        modal.innerHTML = `
            <div class="modal-container">
                <h3>Add Property</h3>
                <form id="property-form">
                    <div class="form-group">
                        <label for="property-name">Property Name *</label>
                        <input type="text" id="property-name" required placeholder="e.g., Sets, Reps, Pages">
                    </div>
                    <div class="form-group">
                        <label for="property-type">Type *</label>
                        <select id="property-type" required>
                            <option value="number">Number</option>
                            <option value="text">Text</option>
                            <option value="url">URL</option>
                            <option value="checkbox">Checkbox</option>
                            <option value="date">Date</option>
                            <option value="time">Time</option>
                            <option value="duration">Duration (minutes)</option>
                            <option value="rating">Rating (1-5)</option>
                            <option value="select">Select (dropdown)</option>
                        </select>
                    </div>
                    <div class="form-group" id="select-options-group" style="display: none;">
                        <label>Options *</label>
                        <div id="options-list"></div>
                        <div style="display: flex; gap: 8px; margin-top: 8px;">
                            <input type="text" id="option-input" placeholder="Enter option">
                            <button type="button" class="btn btn-secondary btn-sm" id="add-option-btn">+ Add</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="property-required">
                            <span>Required</span>
                        </label>
                    </div>
                    <div class="modal-actions">
                        <button type="submit" class="btn btn-primary">Add</button>
                        <button type="button" class="btn btn-secondary" id="cancel-property-btn">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        const propertyForm = modal.querySelector('#property-form') as HTMLFormElement;
        const cancelBtn = modal.querySelector('#cancel-property-btn') as HTMLButtonElement;
        const propertyTypeSelect = modal.querySelector('#property-type') as HTMLSelectElement;
        const selectOptionsGroup = modal.querySelector('#select-options-group') as HTMLElement;
        const optionInput = modal.querySelector('#option-input') as HTMLInputElement;
        const addOptionBtn = modal.querySelector('#add-option-btn') as HTMLButtonElement;
        const optionsList = modal.querySelector('#options-list') as HTMLElement;

        let selectOptions: string[] = [];

        // Show/hide select options based on type
        propertyTypeSelect.addEventListener('change', () => {
            if (propertyTypeSelect.value === 'select') {
                selectOptionsGroup.style.display = 'block';
            } else {
                selectOptionsGroup.style.display = 'none';
            }
        });

        // Add option to list
        const renderOptions = () => {
            if (selectOptions.length === 0) {
                optionsList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">No options added yet.</p>';
            } else {
                optionsList.innerHTML = selectOptions.map((opt, idx) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
                        <span>${opt}</span>
                        <button type="button" class="btn-remove-option" data-index="${idx}" style="background: none; border: none; color: var(--danger); cursor: pointer; padding: 4px 8px;">✕</button>
                    </div>
                `).join('');

                // Attach remove handlers
                optionsList.querySelectorAll('.btn-remove-option').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const index = parseInt((e.target as HTMLElement).dataset.index || '0');
                        selectOptions.splice(index, 1);
                        renderOptions();
                    });
                });
            }
        };

        addOptionBtn.addEventListener('click', () => {
            const value = optionInput.value.trim();
            if (value && !selectOptions.includes(value)) {
                selectOptions.push(value);
                optionInput.value = '';
                renderOptions();
            }
        });

        // Allow Enter key to add option
        optionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addOptionBtn.click();
            }
        });

        const cleanup = () => {
            document.body.removeChild(modal);
        };

        propertyForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = (modal.querySelector('#property-name') as HTMLInputElement).value.trim();
            const valueType = (modal.querySelector('#property-type') as HTMLSelectElement).value as ValueType;
            const required = (modal.querySelector('#property-required') as HTMLInputElement).checked;

            // Validate select type has options
            if (valueType === 'select' && selectOptions.length === 0) {
                alert('Please add at least one option for the select field.');
                return;
            }

            if (name) {
                const newProperty: EntityProperty = {
                    id: generateId(),
                    name: capitalizeFirstLetter(name),
                    valueType,
                    required
                };

                // Add options if select type
                if (valueType === 'select') {
                    newProperty.options = selectOptions.map(opt => ({
                        value: opt.toLowerCase().replace(/\s+/g, '-'),
                        label: opt
                    } as SelectOption));
                }

                this.properties.push(newProperty);
                this.updatePropertiesList();
                cleanup();
            }
        });

        cancelBtn.addEventListener('click', cleanup);
    }

    private handleRemoveProperty(index: number): void {
        if (confirm('Are you sure you want to remove this property?')) {
            this.properties.splice(index, 1);
            this.updatePropertiesList();
        }
    }

    private updatePropertiesList(): void {
        const container = this.querySelector('#properties-list');
        if (container) {
            container.innerHTML = this.renderPropertiesList();
            // Re-attach event listeners for remove buttons
            container.querySelectorAll('.btn-remove-property').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt((e.target as HTMLElement).dataset.index || '0');
                    this.handleRemoveProperty(index);
                });
            });
        }
    }

    public checkUnsavedChanges(): boolean {
        if (this.hasUnsavedChanges) {
            return confirm('You have unsaved changes. Are you sure you want to close without saving?');
        }
        return true;
    }

    private async handleSubmit(e: Event): Promise<void> {
        e.preventDefault();

        try {
            const name = (this.querySelector('#entity-name') as HTMLInputElement).value.trim();
            const type = (this.querySelector('#entity-type') as HTMLSelectElement).value as EntityType;

            const formData: EntityFormData = {
                name,
                type
            };

            // Create new entity
            const entity = Entity.fromFormData(formData);
            entity.properties = this.properties;
            await this.store.addEntity(entity);

            // Reset unsaved changes flag
            this.hasUnsavedChanges = false;

            // Close the panel via URL
            URLStateManager.closePanel();

            // Reset form
            (e.target as HTMLFormElement).reset();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            toast.error(message);
        }
    }
}
