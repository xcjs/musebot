import { IStructuredRequestData } from '../../../../llm/ollama/models/IStructuredRequestData.js';
import { SongPromptType } from './SongPromptType.js';

export const songPromptTypeRequestTypeData: IStructuredRequestData = {
  systemPrompt: 'Determine whether the given song prompt describes a lyrical or instrumental song, '
    + 'whether it contains a comma separated list of descriptive tags, '
    + 'and whether it contains any lyrics. '
    + 'A prompt with no lyrics still describes a lyrical song unless it explicitly requests an instrumental. '
    + 'Default to lyrical unless the prompt explicitly requests an instrumental. '
    + 'Return only valid JSON.',
  schema: {
    type: 'object',
    properties: {
      songPromptType: {
        enum: Object.values(SongPromptType),
        description: 'Whether the song should contain lyrics (lyrical) or not (instrumental). '
          + 'Default to lyrical unless the prompt explicitly requests an instrumental.'
      },
      promptHasTags: {
        type: 'boolean',
        description: 'True if the prompt includes a comma separated list of descriptive tags.'
      },
      promptHasLyrics: {
        type: 'boolean',
        description: 'True if the prompt contains actual lyric text (not just structure tags like [verse] or [chorus]).'
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
