import type { RecipeJsonLd } from "./recipe";

/**
 * Enhanced recipe with additional extracted data and enhanced instructions
 */
export interface EnhancedRecipe extends RecipeJsonLd {
	/** Enhanced image data from ImageService */
	image?: {
		'@type': 'ImageObject';
		'@context'?: string;
		primaryContentUrl?: string;
		additionalContentUrl?: string[];
	};
	/** Enhanced video data from VideoService */
	video?: {
		'@type': 'VideoObject';
		'@context'?: string;
		name?: string;
		description?: string;
		contentUrl?: string;
		thumbnailUrl?: string[];
	};
	datePublished?: string;
}
