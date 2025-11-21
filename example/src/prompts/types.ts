export type RecipeExtractionInput = {
	html: string;
	name?: string;
	description?: string;
	plugins: {
		minify?: Record<string, string>;
		images?: string[] | null;
		videos?: string[] | null;
		'ld-json'?: unknown;
	};
};

export type HeadlineGenerationInput = {
	name: string;
	description?: string;
};

export type HeadlineGenerationResponse = {
	headline: string;
};

export type RecipeExtrasInput = {
	rawHtml: string;
	minificationMap?: Record<string, string>;
};

export type RecipeExtrasResponse = {
	extras: Record<string, unknown>;
};

export type PromptInput = RecipeExtractionInput | HeadlineGenerationInput | RecipeExtrasInput;
