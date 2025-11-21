/**
 * Recipe utilities - clean, modular, and DRY
 *
 * To add a new field:
 * 1. Add to FieldName type in managed-recipe.ts
 * 2. Add to FIELD_CONFIG in field-config.ts
 * 3. Done! It automatically works in wrap/unwrap/validate
 */

export { wrapRecipe, wrapField, pruneHistory } from './wrap.js';
export { unwrapRecipe } from './unwrap.js';
export { validateManagedRecipe } from './validate.js';
export { normalizeUrl } from '../url-hash.js';
export { FIELD_CONFIG, EDITABLE_FIELDS, isEditableField, getFieldRenderer } from './field-config.js';
