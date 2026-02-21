import { IStructuredRequestData } from '../../../../llm/ollama/models/IStructuredRequestData.js';
import { SongPromptType } from './SongPromptType.js';

export const songPromptTypeRequestTypeData: IStructuredRequestData = {
    systemPrompt: 'Your job is to determine what kind of song prompt is provided, '
        + 'if the song prompt contains a comma separated list of descriptive tags, '
        + 'and if the prompt contains any lyrics.',
    schema: {
        type: 'object',
        properties: {
            songPromptType: {
                enum: Object.values(SongPromptType),
                description: 'Whether the requested song should contain lyrics or not (lyrical or instrumental).'
            },
            promptHasTags: {
                type: 'boolean',
                description: 'Set to true if the prompt includes a comma separated list of descriptive tags. Otherwise set to false.'
            },
            promptHasLyrics: {
                type: 'boolean',
                description: 'Set to true if the prompt has any lyrics. Otherwise set to false.'
            }
        },
        required: [
            'songPromptType',
            'promptHasTags',
            'promptHasLyrics'
        ]
    }
};

export type SongPromptRequestType = {
    songPromptType: SongPromptType,
    promptHasTags: boolean,
    promptHasLyrics: boolean
};
