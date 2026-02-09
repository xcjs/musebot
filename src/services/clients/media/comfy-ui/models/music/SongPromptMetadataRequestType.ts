import { IStructuredRequestData } from '../../../../llm/ollama/models/IStructuredRequestData.js';

export const songPromptMetadataRequestData: IStructuredRequestData = {
    systemPrompt: 'Your job is to assist with building a song based on the prompt you are given. '
        + 'The description may or may not already include a comma separated list of descriptive song tags and/or lyrics. '
        + 'You will write lyrics if they are missing. Songs tags should only relate to musical terminology or concepts.',
    schema: {
        "type": "object",
        "properties": {
            "tags": {
                "type": "array",
                "description": "Tags are for terms or phrases that describe the song genre(s), mood, instruments, vocals, vocal gender, pitch, and more. Anything goes, and use a lot of detail. If the prompt already includes tags, include all of them. You may add additional tags if you choose to. All tags should relate to musical terminology.",
                "items": {
                    "type": "string"
                }
            },
            "lyrics": {
                "type": "string",
                "description": "Song lyrics with verses for the provided prompt. Verses can be marked up with [intro], [verse], [bridge], [chorus], or [outro] tags before each verse. Instrument hints or song instructions can be included in parentheses, such as (guitar solo)."
            },
            "keyScale": {
                "enum": [
                    "C major",
                    "C# major",
                    "Db major",
                    "D major",
                    "D# major",
                    "Eb major",
                    "E major",
                    "F major",
                    "F# major",
                    "G major",
                    "G# major",
                    "A# major",
                    "Bb major",
                    "B major",
                    "C minor",
                    "C# minor",
                    "Db minor",
                    "D minor",
                    "D# minor",
                    "Eb minor",
                    "E minor",
                    "F minor",
                    "F# minor",
                    "Gb minor",
                    "G minor",
                    "G# minor",
                    "Ab minor",
                    "A minor",
                    "A# minor",
                    "Bb minor"
                ]
            },
            "bpm": {
                "type": "number"
            },
            "timeSignature": {
                "enum": [
                    2,
                    3,
                    4,
                    6
                ]
            }
        },
        "required": [
            "tags",
            "lyrics",
            "keyScale",
            "bpm",
            "timeSignature"
        ]
    }
}

export type SongPromptMetadataRequestType = {
    tags: string[],
    lyrics: string,
    keyScale: 'C major' | 'C# major' | 'Db major'
        | 'D major' | 'D# major' | 'Eb major'
        | 'E major' | 'F major' | 'F# major'
        | 'G major' | 'G# major' | 'A# major'
        | 'Bb major' | 'B major' | 'C minor'
        | 'C# minor' | 'Db minor' | 'D minor'
        | 'D# minor' | 'Eb minor' | 'E minor'
        | 'F minor' | 'F# minor' | 'Gb minor'
        | 'G minor' | 'G# minor' | 'Ab minor'
        | 'A minor' | 'A# minor' | 'Bb minor'
    bpm: number,
    timeSignature: 2 | 3 | 4 | 6
};
