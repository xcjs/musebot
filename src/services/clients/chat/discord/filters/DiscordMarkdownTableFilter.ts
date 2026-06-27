import { splitText } from '../../../../../utilities/string-utilities.js';
import { IChatMessage } from '../../IChatMessage.js';
import { IChatMessageFilter } from '../../IChatMessageFilter.js';

const CODE_FENCE = '```';
const MAX_COLUMN_WIDTH = 18;
const MIN_COLUMN_WIDTH = 3;

interface ParsedRow {
    cells: string[];
    isSeparator: boolean;
}

export class DiscordMarkdownTableFilter implements IChatMessageFilter {
    process(messages: IChatMessage[]): Promise<IChatMessage[]> {
        if (messages.length === 0) {
            return Promise.resolve(messages);
        }

        const result: IChatMessage[] = messages.map(message => ({
            content: this.#replaceTables(message.content),
            attachments: message.attachments
        }));

        return Promise.resolve(result);
    }

    async processStreaming(messages: IChatMessage[], isDone: boolean): Promise<IChatMessage[]> {
        if (!isDone) {
            return messages;
        }

        return await this.process(messages);
    }

    #replaceTables(content: string): string {
        const lines = content.split('\n');
        const result: string[] = [];
        let i = 0;
        let inCodeFence = false;

        while (i < lines.length) {
            const trimmed = lines[i].trimStart();

            if (trimmed.startsWith(CODE_FENCE)) {
                inCodeFence = !inCodeFence;
                result.push(lines[i]);
                i++;
                continue;
            }

            if (inCodeFence) {
                result.push(lines[i]);
                i++;
                continue;
            }

            if (this.#isTableRow(lines[i])
                && i + 1 < lines.length
                && this.#isSeparatorRow(lines[i + 1])) {
                const tableLines: string[] = [lines[i], lines[i + 1]];
                i += 2;

                while (i < lines.length && this.#isTableRow(lines[i])) {
                    tableLines.push(lines[i]);
                    i++;
                }

                result.push(this.#formatTable(tableLines));
            } else {
                result.push(lines[i]);
                i++;
            }
        }

        return result.join('\n');
    }

    #isTableRow(line: string): boolean {
        const trimmed = line.trim();
        return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 1;
    }

    #isSeparatorRow(line: string): boolean {
        if (!this.#isTableRow(line)) {
            return false;
        }

        const cells = this.#splitCells(line);

        return cells.length > 0 && cells.every(cell => /^:?-+:?$/.test(cell.trim()));
    }

    #splitCells(row: string): string[] {
        const trimmed = row.trim();
        const inner = trimmed.slice(1, -1);

        return inner.split('|').map(cell => cell.trim());
    }

    #parseTable(lines: string[]): ParsedRow[] {
        return lines.map(line => ({
            cells: this.#splitCells(line),
            isSeparator: this.#isSeparatorRow(line)
        }));
    }

    #formatTable(lines: string[]): string {
        const rows = this.#parseTable(lines);

        if (rows.length < 2) {
            return lines.join('\n');
        }

        const numCols = Math.max(...rows.map(row => row.cells.length));

        const wrappedRows: string[][][] = rows.map(row =>
            row.isSeparator
                ? row.cells.map(() => [''])
                : row.cells.map(cell => {
                    const wrapped = splitText(cell, MAX_COLUMN_WIDTH);

                    return wrapped.length > 0 ? wrapped : [''];
                }));

        const colWidths: number[] = [];

        for (let col = 0; col < numCols; col++) {
            let maxWidth = MIN_COLUMN_WIDTH;

            for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
                if (rows[rowIdx].isSeparator) {
                    continue;
                }

                const cellLines = wrappedRows[rowIdx]?.[col] ?? [''];

                for (const line of cellLines) {
                    if (line.length > maxWidth) {
                        maxWidth = line.length;
                    }
                }
            }

            colWidths.push(maxWidth);
        }

        const rendered: string[] = [];

        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
            if (rows[rowIdx].isSeparator) {
                const parts = colWidths.map(width => '-'.repeat(width));
                rendered.push(`| ${parts.join(' | ')} |`);
                continue;
            }

            const cellLines = wrappedRows[rowIdx];
            const maxLines = Math.max(...cellLines.map(lines => lines.length));

            for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
                const parts: string[] = [];

                for (let col = 0; col < numCols; col++) {
                    const text = cellLines[col]?.[lineIdx] ?? '';
                    parts.push(text.padEnd(colWidths[col]));
                }

                rendered.push(`| ${parts.join(' | ')} |`);
            }
        }

        return `${CODE_FENCE}text\n${rendered.join('\n')}\n${CODE_FENCE}`;
    }
}
