/**
 * Recipe JSON-LD schema interface following schema.org/Recipe
 * @see https://schema.org/Recipe
 */
export interface RecipeJsonLd {
	'@type': 'Recipe';
	'@context'?: string;
	id?: string;
	name?: string;
	description?: string;
	headline?: string;
	url?: string;
	mainEntityOfPage?: string;
	recipeIngredient?: string[];
	recipeInstructions?: Array<string | HowToStep | HowToSection>;
	nutrition?: NutritionInformation;
	video?: {
		'@type': 'VideoObject';
		'@context'?: string;
		name?: string;
		description?: string;
		contentUrl?: string;
		thumbnailUrl?: string[];
	};
	image?: {
		'@type': 'ImageObject';
		'@context'?: string;
		primaryContentUrl?: string;
		additionalContentUrl?: string[];
	};
	datePublished?: string;
	prepTime?: string;
	cookTime?: string;
	totalTime?: string;
	recipeYield?: string[];
	recipeCategory?: string[];
	recipeCuisine?: string[];
	keywords?: string;
	isPartOf?: string | { '@id': string } | Array<string | { '@id': string }>;
	author?: AuthorInformation ;
	[key: string]: unknown;
}

/**
 * Author information schema following schema.org/Person
 * @see https://schema.org/Person
 */
export interface AuthorInformation {
	'@type': 'Person'
	name?: string;
	url?: string;
	[key: string]: unknown;
}


/**
 * NutritionInformation schema following schema.org/NutritionInformation
 * @see https://schema.org/NutritionInformation
 */
export interface NutritionInformation {
	'@type': 'NutritionInformation';
	calories?: string | number;
	carbohydrateContent?: string | number;
	proteinContent?: string | number;
	fatContent?: string | number;
	fiberContent?: string | number;
	sugarContent?: string | number;
	sodiumContent?: string | number;
	[key: string]: unknown; // Allow additional properties
}

/**
 * HowToStep schema following schema.org/HowToStep
 * @see https://schema.org/HowToStep
 */
export interface HowToStep {
	'@type': 'HowToStep';
	text?: string;
	name?: string;
	image?: string[];
	note?: string;
	[key: string]: unknown;
}

/**
 * HowToSection schema following schema.org/HowToSection
 * @see https://schema.org/HowToSection
 */
export interface HowToSection {
	'@type': 'HowToSection';
	name?: string;
	steps?: HowToStep[];
	itemListElement?: HowToStep[]; // Alternative property name used in some implementations
	[key: string]: unknown;
}
