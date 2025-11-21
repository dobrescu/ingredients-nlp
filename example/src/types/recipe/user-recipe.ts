import type { EnhancedRecipe } from "./enhanced-recipe";

export interface UserRecipe extends EnhancedRecipe {
  baseRecipeId: string;
}
