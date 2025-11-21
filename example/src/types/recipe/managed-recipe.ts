import type {
	RecipeJsonLd,
	HowToStep,
	HowToSection,
	NutritionInformation,
	AuthorInformation,
} from './recipe.js';

/**
 * Format type for rendered content
 */
export type RenderedContentType = 'markdown' | 'html' | 'text' | 'rich';

/**
 * Rendered content with format metadata
 */
export interface RenderedContent {
	/** Format type */
	type: RenderedContentType;
	/** Rendered content string */
	value: string;
	/** Renderer version (e.g., "1.0.0") */
	version: string;
	/** Optional S3 reference if stored externally */
	ref?: string;
}

/**
 * Source of field modification
 */
export type HistorySource = 'prepper' | 'llm' | 'user';

/**
 * History entry tracking a single modification to a field
 */
export interface HistoryEntry {
	/** ISO 8601 timestamp */
	timestamp: string;
	/** Content hash at this point in time */
	hash: string;
	/** Source of the modification */
	source: HistorySource;
	/** Actor identifier (firebaseUID or 'system') */
	actor?: string;
	/** LLM model used (if source='llm'), e.g., "claude-3-5-sonnet-20241022" */
	llmModel?: string;
	/** Prompt version used (if source='llm'), e.g., "recipe-extras-v1.2.0" */
	promptVersion?: string;
	/** Human-readable summary of the change */
	summary: string;
}

/**
 * Wrapper for every recipe field enabling change tracking, storage routing, and observability
 * @template T The type of the wrapped value
 */
export interface ManagedField<T> {
	/** JSON-LD canonical structure (source of truth for hashing, persistence, AI) */
	value: T;
	/** Display representation (markdown for Kassi) */
	rendered: RenderedContent;
	/** SHA-256 hex hash of `value` for change detection */
	currentHash: string;
	/** Hash of original unimproved version (enables improvement reuse) */
	baseHash: string;
	/** Edit history tracking all modifications (last 20 entries kept) */
	history: HistoryEntry[];
}

/**
 * Derived properties computed from history (not stored in database)
 */
export interface ManagedFieldDerived {
	/** True if any history entry has source === 'user' */
	isUserEdited: boolean;
	/** True if any history entry has source === 'llm' */
	isAiImproved: boolean;
	/** Last history entry timestamp */
	lastModifiedAt: string;
	/** Last history entry actor */
	lastModifiedBy: string | undefined;
}

/**
 * ImageObject following schema.org/ImageObject (from Prepper)
 */
export interface ImageObject {
	'@type': 'ImageObject';
	'@context'?: string;
	primaryContentUrl?: string;
	additionalContentUrl?: string[];
}

/**
 * Person following schema.org/Person
 */
export interface Person {
	'@type': 'Person';
	name: string;
	url?: string;
}

/**
 * Organization following schema.org/Organization
 */
export interface Organization {
	'@type': 'Organization';
	name: string;
	url?: string;
}

/**
 * AggregateRating following schema.org/AggregateRating
 */
export interface AggregateRating {
	'@type': 'AggregateRating';
	ratingValue: number;
	ratingCount: number;
	bestRating?: number;
	worstRating?: number;
}

/**
 * VideoObject following schema.org/VideoObject (from Prepper)
 */
export interface VideoObject {
	'@type': 'VideoObject';
	'@context'?: string;
	name?: string;
	description?: string;
	contentUrl?: string;
	thumbnailUrl?: string[];
}

/**
 * Recipe instruction type (HowToStep or HowToSection)
 */
export type RecipeInstruction = HowToStep | HowToSection;

/**
 * Complete recipe with all editable fields wrapped in ManagedField
 */
export interface ManagedRecipe {
	// ===== Non-wrapped metadata (system-managed, not user-editable) =====
	/** SHA-256 hash of normalized URL */
	urlHash: string;
	/** Source URL */
	originalUrl: string;
	/** ISO 8601 timestamp of creation */
	createdAt: string;
	/** ISO 8601 timestamp of last modification */
	lastModified: string;
	/** Schema version, e.g., "1.0.0" */
	schemaVersion: string;

	// ===== Wrapped editable fields (all use ManagedField<T>) =====
	/** Recipe title */
	name?: ManagedField<string>;
	/** Short summary */
	description?: ManagedField<string>;
	/** Headline for the recipe */
	headline?: ManagedField<string>;
	/** e.g., "4 servings" */
	recipeYield?: ManagedField<string[]>;
	/** ISO 8601 duration, e.g., "PT45M" */
	totalTime?: ManagedField<string>;
	/** Prep time in ISO 8601 duration */
	prepTime?: ManagedField<string>;
	/** Cook time in ISO 8601 duration */
	cookTime?: ManagedField<string>;
	/** Ingredient list */
	recipeIngredient?: ManagedField<string[]>;
	/** Step-by-step instructions */
	recipeInstructions?: ManagedField<RecipeInstruction[]>;
	/** Cuisine types */
	recipeCategory?: ManagedField<string[]>;
	/** Cuisine style */
	recipeCuisine?: ManagedField<string[]>;
	/** Searchable tags */
	keywords?: ManagedField<string>;
	/** Image URL or object */
	image?: ManagedField<ImageObject>;
	/** Creator info */
	author?: ManagedField<AuthorInformation>;
	/** Reviews aggregate */
	aggregateRating?: ManagedField<AggregateRating | null>;
	/** Nutritional data */
	nutrition?: ManagedField<NutritionInformation | null>;
	/** Video object */
	video?: ManagedField<VideoObject | null>;
	/** Date published */
	datePublished?: ManagedField<string>;
}

/**
 * Valid recipe field names (type-safe enumeration)
 */
export type FieldName =
	| 'name'
	| 'description'
	| 'headline'
	| 'recipeYield'
	| 'totalTime'
	| 'prepTime'
	| 'cookTime'
	| 'recipeIngredient'
	| 'recipeInstructions'
	| 'recipeCategory'
	| 'recipeCuisine'
	| 'keywords'
	| 'image'
	| 'author'
	| 'aggregateRating'
	| 'nutrition'
	| 'video'
	| 'datePublished';

/**
 * Type guard to check if a string is a valid FieldName
 */
export function isFieldName(key: string): key is FieldName {
	const validFieldNames: FieldName[] = [
		'name',
		'description',
		'headline',
		'recipeYield',
		'totalTime',
		'prepTime',
		'cookTime',
		'recipeIngredient',
		'recipeInstructions',
		'recipeCategory',
		'recipeCuisine',
		'keywords',
		'image',
		'author',
		'aggregateRating',
		'nutrition',
		'video',
		'datePublished',
	];
	return validFieldNames.includes(key as FieldName);
}

/**
 * Flattened format for DynamoDB storage
 */
export interface StoredRecipe {
	/** Partition key: 'recipe#<urlHash>' or 'user#<firebaseUID>' */
	PK: string;
	/** Sort key: 'base' or 'recipe#<urlHash>' */
	SK: string;
	/** SHA-256 hash of normalized URL */
	urlHash: string;
	/** Source URL */
	originalUrl: string;
	/** ISO 8601 timestamp */
	createdAt: string;
	/** ISO 8601 timestamp */
	lastModified: string;
	/** Schema version, e.g., "1.0.0" */
	schemaVersion: string;
	/** Map of field name → JSON-stringified ManagedField */
	fields: Record<string, string>;
}

/**
 * Flat recipe object with rendered markdown strings (sent to/from Kassi)
 *
 * Image, video, and author are unwrapped (no @type/@context) for cleaner frontend integration
 */
export interface SimplifiedRecipe {
	/** Recipe URL (from originalUrl) */
	originalUrl?: string;

	/** Text fields */
	name?: string;
	description?: string;
	headline?: string;
	recipeYield?: string;
	prepTime?: string;
	cookTime?: string;
	totalTime?: string;
	recipeCategory?: string;
	recipeCuisine?: string;
	keywords?: string;
	datePublished?: string;

	/** List fields as markdown, e.g., "- **2 cups** flour\n- 1 tsp salt" */
	recipeIngredient?: string;

	/** Structured fields as markdown, e.g., "## Prepare\n\n1. Mix ingredients" */
	recipeInstructions?: string;

	/** Nutrition object */
	nutrition?: NutritionInformation;

	/** Author name (unwrapped from AuthorInformation object) */
	author?: string;

	/** Image URLs (unwrapped from ImageObject, no @type/@context) */
	image?: {
		primaryContentUrl?: string;
		additionalContentUrl?: string[];
	};

	/** Video data (unwrapped from VideoObject, no @type/@context) */
	video?: {
		name?: string;
		description?: string;
		contentUrl?: string;
		thumbnailUrl?: string[];
	};
}

/**
 * Request payload for batch LLM improvements
 */
export interface ImprovementRequest {
	/** User identifier */
	firebaseUID: string;
	/** Recipe identifier */
	urlHash: string;
	/** Fields to improve (processed in parallel) */
	fieldNames: FieldName[];
	/** LLM provider (default: bedrock) */
	provider?: 'bedrock' | 'chatgpt';
}

/**
 * Result of improving a single field
 */
export interface ImprovementResult {
	/** Which field was processed */
	fieldName: FieldName;
	/** Whether improvement succeeded */
	success: boolean;
	/** Whether content actually changed (via hash comparison) */
	changed: boolean;
	/** Updated field (if changed) */
	newValue?: ManagedField<unknown>;
	/** Error message (if failed) */
	error?: string;
}

/**
 * Complete response for batch improvement operation
 */
export interface ImprovementResponse {
	/** Per-field results */
	results: ImprovementResult[];
	/** Complete recipe with all improvements applied */
	updatedRecipe: ManagedRecipe;
}

/**
 * Extract raw value type from ManagedField<T>
 */
export type UnwrapField<T> = T extends ManagedField<infer U> ? U : never;

/**
 * Recipe with all fields unwrapped (legacy format for backward compatibility)
 */
export type UnwrappedRecipe = {
	[K in keyof ManagedRecipe]: ManagedRecipe[K] extends ManagedField<infer U>
		? U
		: ManagedRecipe[K];
};

/**
 * Helper to compute derived properties from a ManagedField
 */
export function getDerivedProperties<T>(
	field: ManagedField<T>
): ManagedFieldDerived {
	const isUserEdited = field.history.some((h) => h.source === 'user');
	const isAiImproved = field.history.some((h) => h.source === 'llm');
	const lastEntry = field.history[field.history.length - 1];

	return {
		isUserEdited,
		isAiImproved,
		lastModifiedAt: lastEntry?.timestamp || '',
		lastModifiedBy: lastEntry?.actor,
	};
}
