import { execSync } from 'child_process';

export default function hook() {
	try {
		execSync('npx tsc --noEmit', {
			encoding: 'utf-8',
			stdio: 'pipe'
		});
		return {
			message: '\n✅ TypeScript check passed - no errors\n'
		};
	} catch (error: unknown) {
		const err = error as { stdout?: string; stderr?: string };
		const output = err.stdout || err.stderr || '';
		const errorCount = (output.match(/error TS\d+:/g) || []).length;

		return {
			message: `\n❌ TypeScript check failed - ${errorCount} error(s) found\n\n${output.slice(0, 1000)}\n`
		};
	}
}
