import { build } from 'esbuild';

await build({
	entryPoints: ['src/lambda.ts'],
	bundle: true,
	minify: true,
	sourcemap: true,
	platform: 'node',
	target: 'node22',
	format: 'esm',
	outfile: 'dist/lambda.mjs',
	external: ['node:*', '@aws-sdk/*'],
	logLevel: 'info',
	metafile: true,
})
	.then((result) => {
		console.log('\n📦 Bundle complete!');
		if (result.metafile) {
			for (const [out, info] of Object.entries(result.metafile.outputs)) {
				console.log(`   ${out}: ${(info.bytes / 1024).toFixed(2)} KB`);
			}
		}
	})
	.catch(() => process.exit(1));
