import * as t from 'tschema';

export const songMetadataSchema = t.object({
    tags: t.array(
        t.string({
            description: 'A list of tags describing the song genre, mood, vocalist gender, vocalist range, instruments, and more.'
        })
    ),
    duration: t.integer({
        minimum: 120,
        maximum: 240,
        description: 'The recommended length of the song in seconds.'
    }),
    keyScale: t.enum([
        'C major',
        'C# major',
        'Db major',
        'D major',
        'D# major',
        'Eb major',
        'E major',
        'F major',
        'F# major',
        'G major',
        'G# major',
        'A# major',
        'Bb major',
        'B major',
        'C minor',
        'C# minor',
        'Db minor',
        'D minor',
        'D# minor',
        'Eb minor',
        'E minor',
        'F minor',
        'F# minor',
        'Gb minor',
        'G minor',
        'G# minor',
        'Ab minor',
        'A minor',
        'A# minor',
        'Bb minor',
    ]),
    bpm: t.number({
        description: 'The recommended beats per minute for the song.'
    }),
    timeSignature: t.enum([
        2,
        3,
        4,
        6
    ]),
});
