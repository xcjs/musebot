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
