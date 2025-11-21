export interface HtmlReplacementResult {
	transformedHtml: string;
	replacements: Record<string, string>;
}

export class HtmlReplacementService {
	private replacements: Record<string, string> = {};
	private counters: Record<string, number> = {};

	obfuscate({
		rawHtml,
		replaceTags
	}: {
		rawHtml: string;
		replaceTags: string[];
	}): HtmlReplacementResult {
		if (!rawHtml?.trim()) {
			throw new Error('rawHtml is required');
		}
		if (!Array.isArray(replaceTags) || replaceTags.length === 0) {
			throw new Error('replaceTags must be a non-empty array');
		}

		this.replacements = {};
		this.counters = {};

		let transformed = rawHtml;

		for (const tag of replaceTags) {
			if (tag === 'a') {
				transformed = this.replaceAnchors(transformed);
			} else if (tag === 'img') {
				transformed = this.replaceImages(transformed);
			}
		}

		return {
			transformedHtml: transformed,
			replacements: this.replacements
		};
	}

	restore({ obfuscatedHtml }: { obfuscatedHtml: string }): string {
		if (!obfuscatedHtml?.trim()) {
			throw new Error('obfuscatedHtml is required');
		}
		if (Object.keys(this.replacements).length === 0) {
			throw new Error('No replacements available to restore from');
		}

		let restored = obfuscatedHtml;

		// Restore anchors
		restored = restored.replace(
			/<a\s+href="([^"]+)".*?>(.*?)<\/a>/gi,
			(_, id) => this.replacements[id] || _
		);

		// Restore images
		restored = restored.replace(
			/<img\s+src="([^"]+)"\s*\/?>/gi,
			(_, id) => this.replacements[id] || _
		);

		return restored;
	}

	private replaceAnchors(html: string): string {
		const anchorRegex = /<a\b([^>]*)>(.*?)<\/a>/gi;
		return html.replace(anchorRegex, (_match, attrs, innerText) => {
			const id = this.generateId('a');
			this.replacements[id] = _match;

			// preserve text content, drop attributes, keep href as id
			return `<a href="${id}">${innerText}</a>`;
		});
	}

	private replaceImages(html: string): string {
		const imgRegex = /<img\b([^>]*)>/gi;
		return html.replace(imgRegex, (_match, attrs) => {
			const id = this.generateId('img');
			this.replacements[id] = _match;

			// stripped of all attrs except src=id
			return `<img src="${id}">`;
		});
	}

	private generateId(tag: string): string {
		if (!this.counters[tag]) {
			this.counters[tag] = 1;
		}
		const id = `${tag}-${this.counters[tag]}`;
		this.counters[tag]++;
		return id;
	}
}
