import type { EnhancedRecipe } from './enhanced-recipe.js';

type FragmentLike = string;
type DefaultFragmentType = string;

type BaseFragmentExcerpt<T extends FragmentLike = DefaultFragmentType> = {
  fragment: T;
};

export type FragmentExcerpt<T extends FragmentLike = DefaultFragmentType> =
  BaseFragmentExcerpt<T> & {
    score: number;
  };

export type RawFragmentExcerpt<T extends FragmentLike = DefaultFragmentType> =
  BaseFragmentExcerpt<T> & {
    relevanceScore: number;
    jsonLdScore: number;
  };


/** Content location mapping for a recipe */
export interface ContentLocationMap {
  name?: FragmentExcerpt;
  description?: FragmentExcerpt;
  ingredients?: FragmentExcerpt;
  instructions?: FragmentExcerpt;
  nutrition?: FragmentExcerpt;
}


export type RawRecipePage = {
  raw?: RawFragmentExcerpt;
} & ContentLocationMap;

export interface EnhancedRecipePage {
  url: string | null;
  fragments: RawRecipePage;
  recipes?: EnhancedRecipe[];
  plugins: Array<{ name: string; data: unknown }>;
}
