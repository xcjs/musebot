import { splitText } from '../../../../../utilities/string-utilities.js';
import { IChatMessage } from '../../IChatMessage.js';
import { IChatMessageFilter } from '../../IChatMessageFilter.js';
import { DiscordConstants } from '../enums/DiscordConstants.js';

const CODE_FENCE = '```';
const CODE_FENCE_LENGTH = CODE_FENCE.length;

export class DiscordCodeBlockSplitFilter implements IChatMessageFilter {
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
                content = `${CODE_FENCE}${languageTag}\n${content}`;
            }

            const fenceState = this.#getFenceState(content);
            inCodeBlock = fenceState.inCodeBlock;
            languageTag = fenceState.languageTag;

            if (inCodeBlock && !isLast) {
                content = this.#closeCodeBlock(content);
                const fenceStateAfter = this.#getFenceState(content);
                inCodeBlock = fenceStateAfter.inCodeBlock;
                languageTag = fenceStateAfter.languageTag;
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
        if (content.length + CODE_FENCE_LENGTH <= DiscordConstants.ContentMaxLength) {
            return content.endsWith('\n')
                ? `${content}${CODE_FENCE}`
                : `${content}\n${CODE_FENCE}`;
        }

        const trimmed = this.#trimToFit(content, DiscordConstants.ContentMaxLength - CODE_FENCE_LENGTH - 1);
        return `${trimmed}\n${CODE_FENCE}`;
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

            if (trimmed.startsWith(CODE_FENCE)) {
                if (inCodeBlock) {
                    inCodeBlock = false;
                    languageTag = '';
                } else {
                    inCodeBlock = true;
                    languageTag = trimmed.slice(CODE_FENCE_LENGTH).trim();
                }
            }
        }

        return { inCodeBlock, languageTag };
    }
}