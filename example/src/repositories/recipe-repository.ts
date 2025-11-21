/**
 * Recipe Repository
 *
 * Handles all DynamoDB operations for recipes.
 * Pure data access layer - no business logic.
 * Errors bubble to service/handler layers.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { StoredRecipe, FieldName, ManagedField } from '../types/recipe/managed-recipe.js';
import { env } from '../env.js';

export class RecipeRepository {
	private readonly client: DynamoDBDocumentClient;
	private readonly tableName: string;

	constructor(tableName?: string) {
		const dynamoClient = new DynamoDBClient({});
		this.client = DynamoDBDocumentClient.from(dynamoClient);
		this.tableName = tableName || env.DYNAMODB_COOKBOOKS;

		if (!this.tableName) {
			throw new Error('DYNAMODB_COOKBOOKS environment variable is not defined');
		}
	}

	/**
	 * Get shared recipe (baseline version)
	 */
	async getSharedRecipe(urlHash: string): Promise<StoredRecipe | null> {
		if (!urlHash?.trim()) return null;

		const response = await this.client.send(new GetCommand({
			TableName: this.tableName,
			Key: {
				PK: `recipe#${urlHash}`,
				SK: 'base'
			}
		}));

		return (response.Item as StoredRecipe) || null;
	}

	/**
	 * Get user's customized recipe
	 */
	async getUserRecipe(firebaseUID: string, urlHash: string): Promise<StoredRecipe | null> {
		if (!firebaseUID?.trim() || !urlHash?.trim()) return null;

		const response = await this.client.send(new GetCommand({
			TableName: this.tableName,
			Key: {
				PK: `user#${firebaseUID}`,
				SK: `recipe#${urlHash}`
			}
		}));

		return (response.Item as StoredRecipe) || null;
	}

	/**
	 * Save shared recipe (baseline version)
	 */
	async putSharedRecipe(stored: StoredRecipe): Promise<void> {
		await this.client.send(new PutCommand({
			TableName: this.tableName,
			Item: stored
		}));
	}

	/**
	 * Save user's customized recipe
	 */
	async putUserRecipe(stored: StoredRecipe): Promise<void> {
		await this.client.send(new PutCommand({
			TableName: this.tableName,
			Item: stored
		}));
	}

	/**
	 * Update a single field in user's recipe (partial update)
	 */
	async updateUserField(
		firebaseUID: string,
		urlHash: string,
		fieldName: FieldName,
		field: ManagedField<unknown>
	): Promise<void> {
		if (!firebaseUID?.trim() || !urlHash?.trim()) {
			throw new Error('firebaseUID and urlHash are required');
		}

		const fieldJson = JSON.stringify(field);

		await this.client.send(new UpdateCommand({
			TableName: this.tableName,
			Key: {
				PK: `user#${firebaseUID}`,
				SK: `recipe#${urlHash}`
			},
			UpdateExpression: 'SET #fields.#fieldName = :fieldValue, lastModified = :timestamp',
			ExpressionAttributeNames: {
				'#fields': 'fields',
				'#fieldName': fieldName
			},
			ExpressionAttributeValues: {
				':fieldValue': fieldJson,
				':timestamp': new Date().toISOString()
			}
		}));
	}

	/**
	 * Update a single field in shared recipe (partial update)
	 */
	async updateSharedField(
		urlHash: string,
		fieldName: FieldName,
		field: ManagedField<unknown>
	): Promise<void> {
		if (!urlHash?.trim()) {
			throw new Error('urlHash is required');
		}

		const fieldJson = JSON.stringify(field);

		await this.client.send(new UpdateCommand({
			TableName: this.tableName,
			Key: {
				PK: `recipe#${urlHash}`,
				SK: 'base'
			},
			UpdateExpression: 'SET #fields.#fieldName = :fieldValue, lastModified = :timestamp',
			ExpressionAttributeNames: {
				'#fields': 'fields',
				'#fieldName': fieldName
			},
			ExpressionAttributeValues: {
				':fieldValue': fieldJson,
				':timestamp': new Date().toISOString()
			}
		}));
	}
}
