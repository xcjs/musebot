export function toTitleCase(text: string): string {
    if(text === null
        || text.length === 0) {
        return '';
    }

    return text.replace(
        /\w\S*/g,
        text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
}

export function splitText(text: string, lineLength: number): string[] {
    let mutableBuffer = `${text}`;
    const splitText: string[] = [];

    while (mutableBuffer.length > 0) {
        if (mutableBuffer.length > lineLength) {
            let splitPosition = mutableBuffer.substring(0, lineLength).lastIndexOf('\n');

            if(splitPosition === -1) {
                splitPosition = mutableBuffer.substring(0, lineLength).lastIndexOf(' ');
            }

            if(splitPosition === -1) {
                // If no newline or space is found, split at the lineLength.
                splitPosition = lineLength;
            }

            splitText.push(mutableBuffer.substring(0, splitPosition));
            mutableBuffer = mutableBuffer.substring(splitPosition);
        } else {
            splitText.push(mutableBuffer);
            mutableBuffer = '';
        }
    }

    return splitText;
}

export function wrapText(text: string, lineLength: number): string {
    let wrappedText: string = '';

    while(text.length > 0) {
        if(text.length > lineLength) {
            let lineBreakPosition = text.substring(0, lineLength).lastIndexOf('\n');
            lineBreakPosition = lineBreakPosition > 0 ? lineBreakPosition : text.substring(0, lineLength).lastIndexOf(' ');

            // Account for inclusion of white-space character.
            lineBreakPosition++;

            wrappedText += text.substring(0, lineBreakPosition) + '\n';
            text = text.substring(lineBreakPosition);
        } else {
            wrappedText += `${text}\n`;
            text = '';
        }
    }

    return wrappedText;
}

export function isOnlyWhitespace(text: string): boolean {
    return text.trim().length === 0;
}

export function endsWithWhitespace(text: string): boolean {
    return text.endsWith('\n') || text.endsWith(' ');
}

export function hasOnly(containingText: string, searchText: string): boolean {
    return containingText.trim().replaceAll(searchText, '').length === 0;
}

/**
 * Extracts the first balanced JSON object from a string, discarding any
 * trailing content. Some LLMs emit valid JSON followed by non-JSON artifacts
 * (e.g. `<|tool_response>` tokens, prose, or markdown) despite a structured
 * format constraint, which breaks `JSON.parse`. This function scans with
 * brace-depth tracking that respects string literals and escape sequences,
 * returning the substring from the first `{` through the matching `}`.
 *
 * Also escapes raw control characters (newline, carriage return, tab, etc.)
 * that appear inside JSON string values, which some models emit unescaped
 * (particularly in fields like `lyrics`), causing "Unterminated string" errors.
 * @param text - Raw model output that may contain trailing non-JSON content.
 * @returns The first balanced JSON object with escaped control characters, or the original text if no `{` is found.
 */
export function trimTrailingJsonContent(text: string): string {
    const start = text.indexOf('{');
    if (start === -1) {
        return text;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;
    let result = '';

    for (let i = start; i < text.length; i++) {
        const char = text[i];

        if (inString) {
            if (escaped) {
                escaped = false;
                result += char;
            } else if (char === '\\') {
                escaped = true;
                result += char;
            } else if (char === '"') {
                inString = false;
                result += char;
            } else if (char === '\n') {
                result += '\\n';
            } else if (char === '\r') {
                result += '\\r';
            } else if (char === '\t') {
                result += '\\t';
            } else if (char.charCodeAt(0) < 0x20) {
                result += `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
            } else {
                result += char;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            result += char;
        } else if (char === '{') {
            depth++;
            result += char;
        } else if (char === '}') {
            depth--;
            result += char;
            if (depth === 0) {
                return result;
            }
        } else {
            result += char;
        }
    }

    return result;
}
