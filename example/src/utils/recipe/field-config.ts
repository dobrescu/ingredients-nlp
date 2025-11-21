import type { FieldName } from '../../types/recipe/managed-recipe.js';
import type { HowToStep, HowToSection } from '../../types/recipe/recipe.js';

/**
 * Field renderer function - converts JSON-LD value to display string
 */
type FieldRenderer<T = any> = (value: T) => string;

/**
 * Field type determines wire format from/to Kassi:
 * - 'text': Simple string (sent as text/markdown)
 * - 'list': Array rendered as markdown list for display, sent as markdown
 * - 'object': Complex object (sent as JSON object directly, NOT as markdown)
 */
export type FieldType = 'text' | 'list' | 'object';

/**
 * Field configuration defining how to process each recipe field
 */
interface FieldConfig {
	/** Field type (determines wire format to/from Kassi) */
	type: FieldType;
	/** Display renderer for this field (creates rendered.value) */
	render: FieldRenderer;
	/** Whether this field is required (for validation) */
	required?: boolean;
}

/**
 * Render array as markdown bullet list
 */
const renderList: FieldRenderer<string[]> = (arr) => {
	if (!arr || arr.length === 0) return '';
	return arr.map((item) => `- ${item}`).join('\n');
};

/**
 * Render recipe instructions (handles HowToStep and HowToSection)
 */
const renderInstructions: FieldRenderer<Array<string | HowToStep | HowToSection>> = (instructions) => {
	if (!instructions || instructions.length === 0) return '';

	return instructions
		.map((step, index) => {
			if (typeof step === 'string') {
				return `${index + 1}. ${step}`;
			} else if (step['@type'] === 'HowToStep') {
				return `${index + 1}. ${step.text || ''}`;
			} else if (step['@type'] === 'HowToSection') {
				const sectionName = step.name ? `## ${step.name}\n\n` : '';
				const steps = step.steps || step.itemListElement || [];
				const sectionSteps = steps
					.map((s, i) => `${i + 1}. ${s.text || ''}`)
					.join('\n');
				return `${sectionName}${sectionSteps}`;
			}
			return '';
		})
		.join('\n\n');
};

/**
 * Render simple value as-is (for strings, dates, etc.)
 */
const renderSimple: FieldRenderer<any> = (value) => {
	if (value === null || value === undefined) return '';
	if (typeof value === 'string') return value;
	if (typeof value === 'object' && value.name) return value.name; // For author
	return JSON.stringify(value);
};

/**
 * Render object as JSON string for display
 */
const renderObject: FieldRenderer<any> = (value) => {
	if (value === null || value === undefined) return '';
	return JSON.stringify(value, null, 2);
};

/**
 * Field configuration registry - SINGLE SOURCE OF TRUTH
 * Add new fields here only - they'll automatically work everywhere
 *
 * Field types:
 * - 'text': Simple strings (Kassi sends/receives as text/markdown)
 * - 'list': Arrays (Kassi sends/receives as markdown list, we parse to/from array)
 * - 'object': Complex objects (Kassi sends/receives as JSON object directly, NO markdown)
 */
export const FIELD_CONFIG: Record<FieldName, FieldConfig> = {
	// Text fields (wire format: string)
	name: { type: 'text', render: renderSimple },
	description: { type: 'text', render: renderSimple },
	headline: { type: 'text', render: renderSimple },
	totalTime: { type: 'text', render: renderSimple },
	prepTime: { type: 'text', render: renderSimple },
	cookTime: { type: 'text', render: renderSimple },
	keywords: { type: 'text', render: renderSimple },
	datePublished: { type: 'text', render: renderSimple },

	// List fields (wire format: markdown list string OR array)
	recipeYield: { type: 'list', render: renderList },
	recipeIngredient: { type: 'list', render: renderList },
	recipeInstructions: { type: 'list', render: renderInstructions },
	recipeCategory: { type: 'list', render: renderList },
	recipeCuisine: { type: 'list', render: renderList },

	// Object fields (wire format: JSON object, NOT markdown)
	image: { type: 'object', render: renderObject },
	author: { type: 'object', render: renderObject },
	aggregateRating: { type: 'object', render: renderObject },
	nutrition: { type: 'object', render: renderObject },
	video: { type: 'object', render: renderObject },
};

/**
 * Get all editable field names
 */
export const EDITABLE_FIELDS = Object.keys(FIELD_CONFIG) as FieldName[];

/**
 * Check if a field should be wrapped (exists in config)
 */
export function isEditableField(key: string): key is FieldName {
	return key in FIELD_CONFIG;
}

/**
 * Get renderer for a field
 */
export function getFieldRenderer(fieldName: FieldName): FieldRenderer {
	return FIELD_CONFIG[fieldName].render;
}

/**
 * Get field type (text, list, or object)
 */
export function getFieldType(fieldName: FieldName): FieldType {
	return FIELD_CONFIG[fieldName].type;
}

/**
 * Get all fields of a specific type
 */
export function getFieldsByType(type: FieldType): FieldName[] {
	return EDITABLE_FIELDS.filter((field) => FIELD_CONFIG[field].type === type);
}

/**
 * Check if field is an object type (sent as JSON object, not markdown)
 */
export function isObjectField(fieldName: FieldName): boolean {
	return FIELD_CONFIG[fieldName].type === 'object';
}
