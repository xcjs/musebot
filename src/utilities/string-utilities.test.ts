import { describe, expect, it } from '@jest/globals';

import {
    endsWithWhitespace,
    hasOnly,
    isOnlyWhitespace,
    splitText,
    toTitleCase,
    trimTrailingJsonContent,
    wrapText
} from './string-utilities.js';

describe('string-utilities', () => {
    describe('toTitleCase()', () => {
        it('should convert lowercase text to title case', () => {
            expect(toTitleCase('hello world')).toBe('Hello World');
        });

        it('should convert uppercase text to title case', () => {
            expect(toTitleCase('HELLO WORLD')).toBe('Hello World');
        });

        it('should handle mixed case text', () => {
            expect(toTitleCase('hELLO wORLD')).toBe('Hello World');
        });

        it('should return empty string for null input', () => {
            expect(toTitleCase(null as unknown as string)).toBe('');
        });

        it('should return empty string for empty string input', () => {
            expect(toTitleCase('')).toBe('');
        });

        it('should handle single word', () => {
            expect(toTitleCase('test')).toBe('Test');
        });

        it('should handle text with multiple spaces', () => {
            expect(toTitleCase('hello  world')).toBe('Hello  World');
        });
    });

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

        it('should split at newline character', () => {
            const text = 'hello\nworld test';
            const lineLength = 15;

            const lines = splitText(text, lineLength);

            expect(lines.length).toBe(2);
            expect(lines[0]).toBe('hello');
            expect(lines[1]).toBe('world test');
        });

        it('should split at space when no newline available', () => {
            const text = 'hello world test';
            const lineLength = 8;

            const lines = splitText(text, lineLength);

            expect(lines.length).toBe(3);
            expect(lines[0]).toBe('hello');
            expect(lines[1]).toBe('world');
            expect(lines[2]).toBe('test');
        });

        it('should not infinite loop when newline is at start of buffer', () => {
            const text = 'hello\nworld';
            const lineLength = 6;

            const lines = splitText(text, lineLength);

            expect(lines.length).toBe(2);
            expect(lines[0]).toBe('hello');
            expect(lines[1]).toBe('world');
        });

        it('should split at line length when no newline or space', () => {
            const text = 'helloworldtest';
            const lineLength = 5;

            const lines = splitText(text, lineLength);

            expect(lines.length).toBe(3);
            expect(lines[0]).toBe('hello');
            expect(lines[1]).toBe('world');
            expect(lines[2]).toBe('test');
        });

        it('should handle empty string', () => {
            const lines = splitText('', 10);

            // Empty string returns empty array
            expect(lines.length).toBe(0);
        });
    });

    describe('wrapText()', () => {
        it('should wrap text at line length', () => {
            const text = 'hello world';
            const lineLength = 6;

            const wrapped = wrapText(text, lineLength);

            // wrapText includes the space before the newline
            expect(wrapped).toBe('hello \nworld\n');
        });

        it('should add newline to text shorter than line length', () => {
            const text = 'hello';
            const lineLength = 10;

            const wrapped = wrapText(text, lineLength);

            expect(wrapped).toBe('hello\n');
        });

        it('should wrap at newline character', () => {
            const text = 'hello\nworld test';
            const lineLength = 15;

            const wrapped = wrapText(text, lineLength);

            // Note: includes the newline from input
            expect(wrapped).toBe('hello\n\nworld test\n');
        });

        it('should wrap at space when available', () => {
            const text = 'hello world test';
            const lineLength = 8;

            const wrapped = wrapText(text, lineLength);

            // Splits at 'hello ' (6 chars), then 'world ' (6 chars)
            expect(wrapped).toBe('hello \nworld \ntest\n');
        });

        it('should handle empty string', () => {
            const wrapped = wrapText('', 10);

            // Empty string returns empty string
            expect(wrapped).toBe('');
        });
    });

    describe('isOnlyWhitespace()', () => {
        it('should return true for string with only spaces', () => {
            expect(isOnlyWhitespace('   ')).toBe(true);
        });

        it('should return true for string with only tabs', () => {
            expect(isOnlyWhitespace('\t\t')).toBe(true);
        });

        it('should return true for string with only newlines', () => {
            expect(isOnlyWhitespace('\n\n')).toBe(true);
        });

        it('should return true for string with mixed whitespace', () => {
            expect(isOnlyWhitespace(' \t\n ')).toBe(true);
        });

        it('should return true for empty string', () => {
            expect(isOnlyWhitespace('')).toBe(true);
        });

        it('should return false for string with non-whitespace', () => {
            expect(isOnlyWhitespace('  hello  ')).toBe(false);
        });

        it('should return false for string with single character', () => {
            expect(isOnlyWhitespace('a')).toBe(false);
        });
    });

    describe('endsWithWhitespace()', () => {
        it('should return true for string ending with space', () => {
            expect(endsWithWhitespace('hello ')).toBe(true);
        });

        it('should return true for string ending with newline', () => {
            expect(endsWithWhitespace('hello\n')).toBe(true);
        });

        it('should return false for string not ending with whitespace', () => {
            expect(endsWithWhitespace('hello')).toBe(false);
        });

        it('should return false for string ending with tab', () => {
            expect(endsWithWhitespace('hello\t')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(endsWithWhitespace('')).toBe(false);
        });

        it('should return false for string with whitespace in middle', () => {
            expect(endsWithWhitespace('hel lo')).toBe(false);
        });
    });

    describe('hasOnly()', () => {
        it('should return true when text contains only the search character', () => {
            expect(hasOnly('aaaaa', 'a')).toBe(true);
        });

        it('should return true when text contains only the search character with whitespace', () => {
            expect(hasOnly('  aaa  ', 'a')).toBe(true);
        });

        it('should return false when text contains other characters', () => {
            expect(hasOnly('aabaa', 'a')).toBe(false);
        });

        it('should return true for empty string', () => {
            expect(hasOnly('', 'a')).toBe(true);
        });

        it('should return true for string with only whitespace', () => {
            expect(hasOnly('   ', 'a')).toBe(true);
        });

        it('should work with multi-character search string', () => {
            expect(hasOnly('ababab', 'ab')).toBe(true);
        });

        it('should return false when multi-character search does not match completely', () => {
            expect(hasOnly('ababa', 'ab')).toBe(false);
        });
    });

    describe('trimTrailingJsonContent()', () => {
        it('should trim trailing non-JSON content after a valid object', () => {
            const input = '{"a": 1}\n    <|tool_response>';
            expect(trimTrailingJsonContent(input)).toBe('{"a": 1}');
        });

        it('should handle the reported model output format', () => {
            const input = '{"songPromptType": "instrumental", "promptHasTags": false, "promptHasLyrics": true}\n    <|tool_response>';
            expect(trimTrailingJsonContent(input)).toBe('{"songPromptType": "instrumental", "promptHasTags": false, "promptHasLyrics": true}');
        });

        it('should handle nested objects', () => {
            const input = '{"a": {"b": 2}}\ntrailing';
            expect(trimTrailingJsonContent(input)).toBe('{"a": {"b": 2}}');
        });

        it('should handle braces inside string values', () => {
            const input = '{"a": "has } brace"}\ntrailing';
            expect(trimTrailingJsonContent(input)).toBe('{"a": "has } brace"}');
        });

        it('should handle escaped quotes inside string values', () => {
            const input = '{"a": "say \\"hi\\""}\ntrailing';
            expect(JSON.parse(trimTrailingJsonContent(input))).toEqual({ a: 'say "hi"' });
        });

        it('should return original text when no opening brace', () => {
            expect(trimTrailingJsonContent('no json here')).toBe('no json here');
        });

        it('should return from start to end when no trailing content', () => {
            expect(trimTrailingJsonContent('{"a": 1}')).toBe('{"a": 1}');
        });

        it('should handle whitespace before the object', () => {
            const input = '   \n  {"a": 1}\ntrailing';
            expect(trimTrailingJsonContent(input)).toBe('{"a": 1}');
        });

        it('should return partial text when JSON is incomplete', () => {
            expect(trimTrailingJsonContent('{"a": 1')).toBe('{"a": 1');
        });

        it('should escape raw newlines inside string values', () => {
            const input = '{"lyrics": "line1\nline2"}';
            expect(JSON.parse(trimTrailingJsonContent(input))).toEqual({ lyrics: 'line1\nline2' });
        });

        it('should escape raw carriage returns inside string values', () => {
            const input = '{"lyrics": "line1\rline2"}';
            expect(JSON.parse(trimTrailingJsonContent(input))).toEqual({ lyrics: 'line1\rline2' });
        });

        it('should escape raw tabs inside string values', () => {
            const input = '{"lyrics": "col1\tcol2"}';
            expect(JSON.parse(trimTrailingJsonContent(input))).toEqual({ lyrics: 'col1\tcol2' });
        });

        it('should escape other control characters inside string values', () => {
            const input = '{"a": "val\u0001ue"}';
            expect(JSON.parse(trimTrailingJsonContent(input))).toEqual({ a: 'val\u0001ue' });
        });

        it('should not escape already-escaped newlines inside string values', () => {
            const input = '{"lyrics": "line1\\nline2"}';
            expect(JSON.parse(trimTrailingJsonContent(input))).toEqual({ lyrics: 'line1\nline2' });
        });
    });
});
