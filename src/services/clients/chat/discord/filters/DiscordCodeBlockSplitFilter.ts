import { splitText } from '../../../../../utilities/string-utilities.js';
import { IChatMessage } from '../../IChatMessage.js';
import { IChatMessageFilter } from '../../IChatMessageFilter.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

export class DiscordCodeBlockSplitFilter implements IChatMessageFilter {
    readonly #codeFence = '```';
    readonly #codeFenceLength = 3;

    process(messages: IChatMessage[]): IChatMessage[] {
        if (messages.length === 0) {
            return messages;
        }

        const attachments = messages.flatMap(m => m.attachments);
        let inCodeBlock = false;
        let languageTag = '';
        const result: IChatMessage[] = [];

        for (let i = 0; i < messages.length; i++) {
            const isLast = i === messages.length - 1;
            let content = messages[i].content;

            if (inCodeBlock) {
                content = `${this.#codeFence}${languageTag}\n${content}`;
            }

            const fenceState = this.#getFenceState(content);
            inCodeBlock = fenceState.inCodeBlock;
            languageTag = fenceState.languageTag;

            if (inCodeBlock && !isLast) {
                content = this.#closeCodeBlock(content);
            }

            result.push({
                content,
                attachments: isLast ? attachments : []
            });
        }

        return result;
    }

    processStreaming(messages: IChatMessage[], _isDone: boolean): IChatMessage[] {
        return this.process(messages);
    }

    #closeCodeBlock(content: string): string {
        if (content.length + this.#codeFenceLength <= DiscordConstants.ContentMaxLength) {
            return content.endsWith('\n')
                ? `${content}${this.#codeFence}`
                : `${content}\n${this.#codeFence}`;
        }

        const trimmed = this.#trimToFit(content, DiscordConstants.ContentMaxLength - this.#codeFenceLength - 1);
        return `${trimmed}\n${this.#codeFence}`;
    }

    #trimToFit(content: string, maxLength: number): string {
        if (content.length <= maxLength) {
            return content;
        }

        const trimmed = splitText(content, maxLength);

        return trimmed[0];
    }

    #getFenceState(content: string): { inCodeBlock: boolean; languageTag: string } {
        const lines = content.split('\n');
        let inCodeBlock = false;
        let languageTag = '';

        for (const line of lines) {
            const trimmed = line.trimStart();

            if (trimmed.startsWith(this.#codeFence)) {
                if (inCodeBlock) {
                    inCodeBlock = false;
                    languageTag = '';
                } else {
                    inCodeBlock = true;
                    languageTag = trimmed.slice(this.#codeFenceLength).trim();
                }
            }
        }

        return { inCodeBlock, languageTag };
    }
}