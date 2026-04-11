// Pure CSV parser implementing RFC 4180 subset
// States: 0=IN_CELL_UNQUOTED, 1=IN_CELL_QUOTED, 2=MAYBE_ESCAPE_QUOTE

export function parse(csvText) {
    if (typeof csvText !== 'string') {
        throw new TypeError('csvText must be a string');
    }

    if (csvText.length === 0) {
        return [];
    }

    const rows = [];
    let currentRow = [];
    let cell = '';
    let state = 0; // 0=unquoted, 1=quoted, 2=maybe_escape
    let i = 0;

    while (i < csvText.length) {
        const char = csvText[i];

        switch (state) {
            case 0: // IN_CELL_UNQUOTED
                if (char === ',') {
                    currentRow.push(cell);
                    cell = '';
                } else if (char === '"') {
                    state = 1; // IN_CELL_QUOTED
                } else if (char === '\n') {
                    currentRow.push(cell);
                    // Skip empty rows
                    if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
                        rows.push(currentRow);
                    }
                    currentRow = [];
                    cell = '';
                } else {
                    cell += char;
                }
                break;

            case 1: // IN_CELL_QUOTED
                if (char === '"') {
                    state = 2; // MAYBE_ESCAPE_QUOTE
                } else {
                    cell += char;
                }
                break;

            case 2: // MAYBE_ESCAPE_QUOTE
                if (char === '"') {
                    // Escaped quote - add to cell
                    cell += '"';
                    state = 1; // back to IN_CELL_QUOTED
                } else {
                    // End of quoted cell
                    state = 0; // back to IN_CELL_UNQUOTED
                    if (char === ',') {
                        currentRow.push(cell);
                        cell = '';
                    } else if (char === '\n') {
                        currentRow.push(cell);
                        rows.push(currentRow);
                        currentRow = [];
                        cell = '';
                    } else if (char === '"') {
                        throw new Error('Unclosed quoted cell: unexpected quote');
                    } else {
                        cell += char;
                    }
                }
                break;

            default:
                throw new Error(`Invalid state: ${state}`);
        }

        i++;
    }

    // Handle any remaining content
    if (state === 1) {
        throw new Error('Unclosed quoted cell');
    }

    if (cell !== '' || currentRow.length > 0) {
        currentRow.push(cell);
        // Skip empty rows
        if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
            rows.push(currentRow);
        }
    }

    return rows;
}