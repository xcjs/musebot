import { JavaScriptType } from '../../../../../../enums/JavaScriptType.js';
import { IStructuredRequestData } from '../../../../llm/ollama/models/IStructuredRequestData.js';
import { KeyScale } from './KeyScale.js';
import { TimeSignature } from './TimeSignature.js';

export const songPromptMetadataRequestData: IStructuredRequestData = {
  systemPrompt: 'You assist with building a song from a prompt, which may already include descriptive tags and/or lyrics. '
    + 'You generate musical tags, lyrics, and metadata. '
    + 'Unless explicitly told the song is instrumental, always write and include lyrics. '
    + 'Section labels in the lyrics MUST be enclosed in square brackets (e.g. [Verse], [Chorus]) - never use "Verse 1:" or other colon-prefixed labels. '
    + 'Return only valid JSON.',
  schema: {
    type: 'object',
    properties: {
      tags: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Descriptive tags for the song caption. Each tag is a short term or phrase. '
          + 'Cover these dimensions where relevant: genre (pop, rock, jazz, electronic, lo-fi, synthwave, etc.), '
          + 'emotion (melancholic, uplifting, energetic, dreamy, dark, nostalgic, etc.), '
          + 'instruments (acoustic guitar, piano, synth pads, 808 drums, strings, brass, etc.), '
          + 'timbre texture (warm, bright, crisp, airy, punchy, lush, raw, etc.), '
          + 'vocal characteristics (female vocal, male vocal, breathy, powerful, falsetto, raspy, choir, etc.), '
          + 'production style (lo-fi, studio-polished, bedroom pop, live recording, etc.), '
          + 'and era reference (80s synth-pop, 90s grunge, modern trap, etc.). '
          + 'Include all tags present in the prompt and add more as appropriate. '
          + 'Do not put tempo, BPM, key, or time signature in the tags - those have dedicated fields. '
          + 'Do not include lyrics here.'
      },
      lyrics: {
        type: 'string',
        description: 'Song lyrics with structure and performance tags. '
          + 'IMPORTANT: Section labels MUST use square brackets, e.g. [Verse] and [Chorus]. '
          + 'NEVER write "Verse 1:", "Chorus:", or any colon-prefixed label - the ACE Step model only recognizes [bracket] tags. '
          + 'Correct: "[Verse]\\nThe sun rises\\n\\n[Chorus]\\nHere we go". '
          + 'Wrong: "Verse 1:\\nThe sun rises\\n\\nChorus:\\nHere we go". '
          + 'Mark each section with structure tags: [Intro], [Verse], [Pre-Chorus], [Chorus], [Bridge], [Outro], '
          + 'or instrumental tags like [Guitar Solo], [Piano Interlude], [Instrumental]. '
          + 'Tags may be combined with a hyphen for performance style, e.g. [Chorus - anthemic] or [Bridge - whispered]. '
          + 'Do not stack more than one modifier per tag. '
          + 'Optional vocal/energy tags within sections: [raspy vocal], [whispered], [falsetto], [powerful belting], '
          + '[spoken word], [harmonies], [high energy], [building energy], [explosive]. '
          + 'Use uppercase letters for higher vocal intensity. Use parentheses for background vocals, e.g. (together). '
          + 'Keep 6-10 syllables per line and separate sections with blank lines. '
          + 'Stick to one core metaphor per song. '
          + 'Write full lyrics unless the song is explicitly instrumental, in which case use [Instrumental] and structure tags only. '
          + 'Keep the lyrics consistent with the tags (instruments, emotion, vocal style must match). '
          + 'Do not include song tags here.'
      },
      keyScale: {
        enum: Object.values(KeyScale),
        description: 'The musical key and scale (major or minor). Common keys (C, G, D, Am, Em) are most stable.'
      },
      bpm: {
        type: 'number',
        description: 'Tempo in beats per minute. Slow songs: 60-80, mid-tempo: 90-120, fast: 130-180.'
      },
      timeSignature: {
        enum: Object.values(TimeSignature).filter(x => typeof x === JavaScriptType.Number.toString()),
        description: 'Time signature as beats per measure: 4 (common time, most reliable), 3 (waltz), or 6 (swing feel).'
      }
    },
    required: [
      'tags',
      'lyrics',
      'keyScale',
      'bpm',
      'timeSignature'
    ]
  }
}

export type SongPromptMetadata = {
  tags: string[],
  lyrics: string,
  keyScale: KeyScale
  bpm: number,
  timeSignature: TimeSignature
};
