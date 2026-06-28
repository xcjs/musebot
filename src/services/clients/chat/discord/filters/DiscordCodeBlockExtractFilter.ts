import { GenerateRequest, GenerateResponse } from 'ollama';

import { IHttpExchangeWithAttachedData } from '../../../../../models/IHttpExchangeWithAttachedData.js';
import { SupportedFeature } from '../../../../features/enum/SupportedFeature.js';
import { IBotServiceContainer } from '../../../../IBotServiceContainer.js';
import { IStructuredRequestData } from '../../../llm/ollama/models/IStructuredRequestData.js';
import { IChatMessage } from '../../IChatMessage.js';
import { IChatMessageAttachment } from '../../IChatMessageAttachment.js';
import { IOutputChatMessageFilter } from '../../IOutputChatMessageFilter.js';

const CODE_FENCE = '```';
const CODE_FENCE_LENGTH = CODE_FENCE.length;
const MAX_ATTACHMENTS = 10;

interface CodeBlock {
    language: string;
    content: string;
}

interface CodeBlockFilenames {
    filenames: string[];
}

const filenameRequestData: IStructuredRequestData = {
    systemPrompt: 'You generate a concise, descriptive filename for each code block, including its file extension. Return only valid JSON.',
    schema: {
        type: 'object',
        properties: {
            filenames: {
                type: 'array',
                items: {
                    type: 'string',
                    description: 'A filename including extension, e.g. "BackupEngine.cs", "utils.py".'
                }
            }
        },
        required: ['filenames']
    }
};

export class DiscordCodeBlockExtractFilter implements IOutputChatMessageFilter {
    readonly #services: IBotServiceContainer;

    constructor(services: IBotServiceContainer) {
        this.#services = services;
    }

    async process(messages: IChatMessage[]): Promise<IChatMessage[]> {
        if (messages.length === 0) {
            return messages;
        }

        const combined = messages.map(m => m.content).join('');
        const existingAttachments = messages.flatMap(m => m.attachments);
        const codeBlocks = this.#extractCodeBlocks(combined);

        const filenames = await this.#getFilenames(codeBlocks, combined);

        const attachments: IChatMessageAttachment[] = codeBlocks.map((block, i) => ({
            name: filenames[i] ?? `code-block-${i + 1}.${this.#getDefaultExtension(block.language)}`,
            data: Buffer.from(block.content, 'utf-8'),
            description: block.language.length > 0 ? `${block.language} code block` : undefined
        }));

        const allAttachments = [...existingAttachments, ...attachments].slice(0, MAX_ATTACHMENTS);

        return [{
            content: combined,
            attachments: allAttachments
        }];
    }

    async processStreaming(messages: IChatMessage[], isDone: boolean): Promise<IChatMessage[]> {
        if (!isDone) {
            return messages;
        }

        return await this.process(messages);
    }

    #extractCodeBlocks(content: string): CodeBlock[] {
        const blocks: CodeBlock[] = [];
        let i = 0;

        while (i < content.length) {
            const fenceStart = content.indexOf(CODE_FENCE, i);

            if (fenceStart === -1) {
                break;
            }

            const afterFence = content.indexOf('\n', fenceStart);

            if (afterFence === -1) {
                break;
            }

            const language = content.substring(fenceStart + CODE_FENCE_LENGTH, afterFence).trim();
            const fenceEnd = content.indexOf(CODE_FENCE, afterFence + 1);

            if (fenceEnd === -1) {
                break;
            }

            const codeContent = content.substring(afterFence + 1, fenceEnd);

            blocks.push({ language, content: codeContent });
            i = fenceEnd + CODE_FENCE_LENGTH;
        }

        return blocks;
    }

    async #getFilenames(codeBlocks: CodeBlock[], messageContext: string): Promise<string[]> {
        if (codeBlocks.length === 0) {
            return [];
        }

        if (!this.#services.featureService.hasFeature(SupportedFeature.Txt2Txt)) {
            return codeBlocks.map((block, i) =>
                `code-block-${i + 1}.${this.#getDefaultExtension(block.language)}`);
        }

        return new Promise((resolve, reject) => {
            const codeBlockInfo = codeBlocks.map((block, i) =>
                `Code block ${i + 1} (${block.language || 'unknown'}):\n${block.content.substring(0, 500)}`
            ).join('\n\n');

            const prompt = `Full message context:\n${messageContext}\n\n---\n\n${codeBlockInfo}`;

            const task = this.#services.getLlmGenerateStructuredTask<CodeBlockFilenames>(prompt, filenameRequestData);
            task.isChild = true;

            const callback = (payload: IHttpExchangeWithAttachedData<GenerateRequest, GenerateResponse, CodeBlockFilenames>): void => {
                resolve(payload.data.filenames);
            };

            task.onSuccess = callback;
            task.onFailure = reject;
            this.#services.taskQueue.add(task as never);
        });
    }

    #getDefaultExtension(language: string): string {
        if (language.length === 0) {
            return 'txt';
        }

        return language.toLowerCase();
    }
}