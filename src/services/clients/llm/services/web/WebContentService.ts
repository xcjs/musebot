import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

import { ILogger } from '../../../../ILogger.js';

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

export interface WebContentResult {
    readonly url: string;
    readonly title: string;
    readonly content: string;
}

export class WebContentService {
    readonly #logger: ILogger;

    constructor(logger: ILogger) {
        this.#logger = logger;
    }

    extractUrls(text: string): string[] {
        const matches = text.match(URL_REGEX);
        return matches ?? [];
    }

    async fetchContent(url: string): Promise<WebContentResult | null> {
        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': 'Musebot/1.0 (+https://github.com/xcjs/musebot)'
                },
                redirect: 'follow',
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) {
                this.#logger.warn(`fetchContent: ${url} returned HTTP ${response.status}.`);
                return null;
            }

            const contentType = response.headers.get('content-type') ?? '';
            if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
                this.#logger.debug(`fetchContent: ${url} is not HTML (content-type: ${contentType}).`);
                return null;
            }

            const html = await response.text();
            const { document } = parseHTML(html);
            const reader = new Readability(document);
            const article = reader.parse();

            if (article === null) {
                this.#logger.debug(`fetchContent: ${url} yielded no readable article.`);
                return null;
            }

            this.#logger.info(`fetchContent: extracted ${article.textContent.length} chars from ${url}.`);

            return {
                url,
                title: article.title ?? url,
                content: article.textContent
            };
        } catch (error) {
            this.#logger.error(`fetchContent: failed to fetch ${url}:`, error);
            return null;
        }
    }

    async fetchAll(urls: string[]): Promise<WebContentResult[]> {
        const results: WebContentResult[] = [];

        for (const url of urls) {
            const result = await this.fetchContent(url);
            if (result !== null) {
                results.push(result);
            }
        }

        return results;
    }
}