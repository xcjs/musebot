import { describe, expect, it } from '@jest/globals';

import { splitText } from './string-utilities.js';

describe('string-utilities', () => {
    describe('splitText()', () => {
        it('should split text one character above the line length', () => {
            const lineLength = 10;
            const text = 'a'.repeat(lineLength + 1);

            const lines = splitText(text, lineLength);

            expect(lines.length).toBe(2);
            expect(lines[0]).toBe('a'.repeat(10));
            expect(lines[1]).toBe('a');
        });

        it('should split text twice the line length', () => {
            const lineLength = 10;
            const text = 'a'.repeat(lineLength * 2);

            const lines = splitText(text, lineLength);

            expect(lines.length).toBe(2);
            expect(lines[0]).toBe('a'.repeat(lineLength));
            expect(lines[1]).toBe('a'.repeat(lineLength));
        });

        it('should not split at the line length', () => {
            const lineLength = 10;
            const text = 'a'.repeat(lineLength);

            const lines = splitText(text, lineLength);

            expect(lines.length).toBe(1);
        });

        it('should not split text one character below the line length', () => {
            const lineLength = 10;
            const text = 'a'.repeat(lineLength);

            const lines = splitText(text, lineLength);

            expect(lines.length).toBe(1);
            expect(lines[0]).toBe(text);
        });
    });
});
