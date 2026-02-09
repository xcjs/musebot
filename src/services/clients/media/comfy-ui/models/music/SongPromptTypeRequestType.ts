import * as t from 'tschema';

import { IStructuredRequestData } from '../../../../llm/ollama/models/IStructuredRequestData.js';

const schema = t.object({
    songPromptType: t.enum(['instrumental', 'lyrical']),
    promptHasTags: t.boolean({
        description:
            'Set to true if the prompt includes a comma separated list of descriptive tags. Otherwise set to false.',
    }),
    promptHasLyrics: t.boolean({
        description:
            'Set to true if the prompt has any lyrics. Otherwise set to false.',
    }),
});

export type SongPromptTypeRequestType = t.Infer<typeof schema>;

export const songPromptTypeRequestTypeData: IStructuredRequestData = {
    systemPrompt: 'Your job is to determine what kind of song prompt is provided, if the song prompt contains a comma separated list of descriptive tags, and if the prompt contains any lyrics.',
    schema: schema
};
