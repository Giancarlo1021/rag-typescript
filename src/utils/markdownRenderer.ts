import { Chalk } from 'chalk';

const ctx = new Chalk({ level: 3 });

/**
 * Strip ANSI codes and markdown to get true string length
 */
function getDisplayLength(str: string): number {
    return str
        .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI codes
        .replace(/\*\*/g, '')             // Remove bold
        .replace(/`/g, '')                // Remove code ticks
        .replace(/\*/g, '')               // Remove italic
        .replace(/~~(.*?)~~/g, '$1')      // Remove strikethrough
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links - keep text only
        .length;
}

/**
 * Apply markdown formatting to text
 */
function applyMarkdown(text: string): string {
    let result = text;

    // Bold (**text** or __text__)
    result = result.replace(/\*\*(.*?)\*\*/g, (match, p1) => ctx.bold.cyanBright(p1));
    result = result.replace(/__(.*?)__/g, (match, p1) => ctx.bold.cyanBright(p1));

    // Inline code (`text`)
    result = result.replace(/`([^`]+?)`/g, (match, p1) => ctx.bgGray.white(` ${p1} `));

    // Italics (*text* or _text_) - must come after bold
    result = result.replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, (match, p1) => ctx.yellowBright(p1));
    result = result.replace(/(?<!_)_(?!_)([^_]+?)(?<!_)_(?!_)/g, (match, p1) => ctx.yellowBright(p1));

    // Links [text](url)
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) =>
        ctx.blue.underline(text) + ctx.gray(` (${url})`)
    );

    // Strikethrough (~~text~~)
    result = result.replace(/~~(.*?)~~/g, (match, p1) => ctx.strikethrough.gray(p1));

    return result;
}

/**
 * Wrap text to fit within a maximum width
 */
function wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (getDisplayLength(testLine) <= maxWidth) {
            currentLine = testLine;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);

    return lines.length > 0 ? lines : [''];
}

/**
 * 📊 Render a table with proper alignment and text wrapping
 */
function renderTable(data: string[][], terminalWidth: number = 120): string {
    if (data.length === 0) return '';

    const borderColor = ctx.cyan;
    const numColumns = Math.max(...data.map(row => row.length));

    // Calculate maximum available width per column
    const borderOverhead = 3 * (numColumns + 1); // pipes and padding
    const availableWidth = Math.min(terminalWidth, 120) - borderOverhead;
    const baseColumnWidth = Math.floor(availableWidth / numColumns);

    // Calculate optimal widths based on content, with a max limit
    const columnWidths = Array(numColumns).fill(0);
    data.forEach(row => {
        row.forEach((cell, idx) => {
            const cleanCell = cell.replace(/\*\*/g, '').replace(/`/g, '').replace(/\*/g, '');
            const cellWidth = Math.min(cleanCell.length, baseColumnWidth);
            columnWidths[idx] = Math.max(columnWidths[idx] || 0, cellWidth);
        });
    });

    // Ensure minimum width and cap maximum
    for (let i = 0; i < columnWidths.length; i++) {
        columnWidths[i] = Math.max(8, Math.min(columnWidths[i], baseColumnWidth));
    }

    const lines: string[] = [];

    // Top border
    lines.push(borderColor('┌' + columnWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┓'));

    data.forEach((row, rowIdx) => {
        // Wrap each cell's content to fit column width
        const wrappedRows: string[][] = [];
        let maxLines = 1;

        row.forEach((cell, colIdx) => {
            const wrapped = wrapText(cell, columnWidths[colIdx]);
            wrappedRows[colIdx] = wrapped;
            maxLines = Math.max(maxLines, wrapped.length);
        });

        // Print each line of this row
        for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
            const lineCells = row.map((cell, colIdx) => {
                const wrappedCell = wrappedRows[colIdx][lineIdx] || '';
                const formatted = applyMarkdown(wrappedCell);
                const displayLen = getDisplayLength(wrappedCell);
                const padding = columnWidths[colIdx] - displayLen;
                return formatted + ' '.repeat(Math.max(0, padding));
            });

            // Header row (first row) in bold
            if (rowIdx === 0) {
                const coloredCells = lineCells.map(c => ctx.bold.magentaBright(c));
                lines.push(borderColor('│ ') + coloredCells.join(borderColor(' │ ')) + borderColor(' │'));
            } else {
                lines.push(borderColor('│ ') + lineCells.join(borderColor(' │ ')) + borderColor(' │'));
            }
        }

        // Separator after header
        if (rowIdx === 0) {
            lines.push(borderColor('├' + columnWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤'));
        }
    });

    // Bottom border
    lines.push(borderColor('└' + columnWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘'));

    return lines.join('\n');
}

/**
 * 🎨 Enhanced Markdown Renderer
 * Renders markdown with proper terminal styling
 */
export function renderMarkdown(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let inTable = false;
    let tableData: string[][] = [];
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Handle code blocks
        if (line.trimStart().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            result.push(ctx.gray('─'.repeat(60)));
            continue;
        }

        if (inCodeBlock) {
            result.push(ctx.bgGray.white(' ' + line + ' '));
            continue;
        }

        // Check if this is a table row (contains pipes)
        if (line.includes('|')) {
            const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);

            // Check if this is a separator row (|---|---|)
            const isSeparator = cells.every(cell => /^[-:]+$/.test(cell));

            if (isSeparator) {
                inTable = true;
                continue; // Skip separator rows
            }

            if (cells.length > 0) {
                inTable = true;
                tableData.push(cells);
                continue;
            }
        }

        // If we were in a table and now we're not, render the table
        if (inTable && !line.includes('|')) {
            result.push(renderTable(tableData));
            result.push(''); // Add spacing after table
            tableData = [];
            inTable = false;
        }

        // Process non-table lines
        let l = line;

        // Headers
        if (l.startsWith('### ')) {
            result.push(ctx.bold.cyanBright(l.replace('### ', '')));
            continue;
        }
        if (l.startsWith('## ')) {
            result.push(ctx.bold.magentaBright(l.replace('## ', '')));
            continue;
        }
        if (l.startsWith('# ')) {
            result.push(ctx.bold.magentaBright.underline(l.replace('# ', '')));
            continue;
        }

        // Blockquotes
        if (l.trimStart().startsWith('>')) {
            result.push(ctx.gray.italic(l.replace(/^\s*>\s*/, '│ ')));
            continue;
        }

        // Horizontal rule
        if (l.trim() === '---' || l.trim() === '***') {
            result.push(ctx.gray('─'.repeat(60)));
            continue;
        }

        // Bullet points and numbered lists
        l = l.replace(/^(\s*)[*\-+]\s+/, (match, spaces) => spaces + ctx.whiteBright('• '));
        l = l.replace(/^(\s*)(\d+)\.\s+/, (match, spaces, num) => spaces + ctx.cyan(`${num}. `));

        // Apply markdown formatting
        l = applyMarkdown(l);

        result.push(l);
    }

    // Render any remaining table data
    if (inTable && tableData.length > 0) {
        result.push(renderTable(tableData));
    }

    return result.join('\n');
}