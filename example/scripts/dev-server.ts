#!/usr/bin/env tsx
/**
 * Development server with hot reload
 * Simple HTTP wrapper for Lambda handler - dynamically reloads on code changes
 */

import { createServer } from 'node:http';
import { URL } from 'node:url';
import dotenv from "dotenv";

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const DEV_USER_ID = process.env.DEV_USER_ID || 'dev-user-local';

const server = createServer(async (req, res) => {
	const url = new URL(req.url || '/', `http://${req.headers.host}`);
	const { pathname, searchParams } = url;
	const method = req.method || 'GET';

	// Read body for POST/PUT requests
	let body: string | undefined;
	if (method === 'POST' || method === 'PUT') {
		const chunks: Buffer[] = [];
		for await (const chunk of req) {
			chunks.push(chunk);
		}
		body = Buffer.concat(chunks).toString('utf-8');
	}

	try {
		// Dynamic import enables hot reload - handler is re-imported on each request
		const { handler } = await import('../src/lambda.js');

		// Build query params object
		const queryStringParameters: Record<string, string> = {};
		searchParams.forEach((value, key) => {
			queryStringParameters[key] = value;
		});

		// Extract path parameters (e.g., /recipe/:urlHash)
		const pathMatch = pathname.match(/\/recipe\/([^\/]+)/);
		const pathParameters = pathMatch ? { urlHash: pathMatch[1] } : undefined;

		// Minimal API Gateway V2 event structure with dev auth injected
		const event = {
			requestContext: {
				http: { method, path: pathname },
				authorizer: {
					jwt: {
						claims: {
							sub: DEV_USER_ID,
						},
					},
				},
			},
			queryStringParameters,
			pathParameters,
			rawPath: pathname,
			headers: req.headers as Record<string, string>,
			body,
		};

		const result = await handler(event as any);

		res.writeHead(result.statusCode || 500, result.headers as Record<string, string>);
		res.end(result.body || '');
	} catch (error) {
		res.writeHead(500, { 'content-type': 'application/json' });
		res.end(JSON.stringify({
			error: 'Internal Server Error',
			message: error instanceof Error ? error.message : String(error)
		}));
	}
});

server.listen(PORT, () => {
	console.log(`🚀 Dev server: http://localhost:${PORT}`);
	console.log(`👤 Auth: ${DEV_USER_ID}`);
	console.log(`✨ Hot reload enabled\n`);
});
