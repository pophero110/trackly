import { ValueType } from '../types/index.js';

/**
 * Configuration for value type input rendering
 *
 * Trackly supports all useful HTML5 input types for flexible data tracking:
 *
 * TEXT-BASED INPUTS:
 * - text: General text input
 * - email: Email address with validation
 * - tel: Phone number
 * - url: URL with validation
 *
 * NUMBER INPUTS:
 * - number: Any numeric value
 * - range: Slider for numeric values (0-100 default)
 *
 * DATE/TIME INPUTS:
 * - date: Date picker (year, month, day)
 * - time: Time picker (hours, minutes)
 * - datetime-local: Date and time picker
 * - month: Month and year picker
 * - week: Week picker
 *
 * SELECTION INPUTS:
 * - checkbox: Boolean true/false toggle
 * - select: Dropdown with custom options (defined per entity)
 *
 * MEDIA INPUTS (URL-based):
 * - image: Image URL (displays as thumbnail)
 * - audio: Audio file URL (displays player)
 * - video: Video file URL (displays player)
 *
 * OTHER:
 * - color: Color picker (hex value)
 *
 * CUSTOM TYPES (using number inputs with constraints):
 * - duration: Minutes (integer, min 0)
 * - rating: 1-10 scale (integer)
 * - hyperlink: Alias for 'url' (legacy support)
 */

export interface ValueTypeInputConfig {
    inputType: 'number' | 'text' | 'url' | 'email' | 'tel' | 'date' | 'time' | 'datetime-local' | 'month' | 'week' | 'range' | 'checkbox' | 'select' | 'color';
    label: string;
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number | 'any';
    options?: Array<{ value: string; label: string }>;
}

/**
 * Maps each ValueType to its input configuration
 */
export const VALUE_TYPE_INPUT_MAP: Record<ValueType, ValueTypeInputConfig> = {
    // Text-based inputs
    'text': {
        inputType: 'text',
        label: 'Value'
    },
    'email': {
        inputType: 'email',
        label: 'Email',
        placeholder: 'user@example.com'
    },
    'tel': {
        inputType: 'tel',
        label: 'Phone Number',
        placeholder: '+1 (555) 123-4567'
    },
    'url': {
        inputType: 'url',
        label: 'URL',
        placeholder: 'https://example.com'
    },
    // Number inputs
    'number': {
        inputType: 'number',
        label: 'Value',
        step: 'any'
    },
    'range': {
        inputType: 'range',
        label: 'Value (Slider)',
        min: 0,
        max: 100,
        step: 1
    },
    // Date/Time inputs
    'date': {
        inputType: 'date',
        label: 'Date'
    },
    'time': {
        inputType: 'time',
        label: 'Time'
    },
    'datetime-local': {
        inputType: 'datetime-local',
        label: 'Date & Time'
    },
    'month': {
        inputType: 'month',
        label: 'Month'
    },
    'week': {
        inputType: 'week',
        label: 'Week'
    },
    // Boolean/Selection
    'checkbox': {
        inputType: 'checkbox',
        label: 'Checkbox'
    },
    'select': {
        inputType: 'select',
        label: 'Select',
        options: []  // Options will be provided by the entity
    },
    // Media (URL-based)
    'image': {
        inputType: 'url',
        label: 'Image URL',
        placeholder: 'https://example.com/image.jpg'
    },
    'audio': {
        inputType: 'url',
        label: 'Audio URL',
        placeholder: 'https://example.com/audio.mp3'
    },
    'video': {
        inputType: 'url',
        label: 'Video URL',
        placeholder: 'https://example.com/video.mp4'
    },
    // Color
    'color': {
        inputType: 'color',
        label: 'Color'
    },
    // Custom types (using number inputs with specific constraints)
    'duration': {
        inputType: 'number',
        label: 'Duration (minutes)',
        min: 0,
        step: 1
    },
    'rating': {
        inputType: 'number',
        label: 'Rating (1-10)',
        min: 1,
        max: 10,
        step: 1
    },
    // Legacy alias
    'hyperlink': {
        inputType: 'url',
        label: 'URL',
        placeholder: 'https://example.com'
    }
};

/**
 * Get input configuration for a value type
 */
export function getValueTypeInputConfig(valueType: ValueType): ValueTypeInputConfig {
    return VALUE_TYPE_INPUT_MAP[valueType];
}
