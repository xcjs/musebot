export function splitText(text: string, lineLength: number): Array<string> {
    const splitText: Array<string> = [];

    while(text.length > 0) {
        if(text.length > lineLength) {
            let splitPosition = text.substring(0, lineLength).lastIndexOf('\n');

            if(splitPosition === -1) {
                splitPosition = text.substring(0, lineLength).lastIndexOf(' ');
            }

            splitText.push(text.substring(0, splitPosition));
            text = text.substring(splitPosition);
        } else {
            splitText.push(text);
            return splitText;
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
            wrappedText += text + '\n';
            return wrappedText;
        }
    }
}
