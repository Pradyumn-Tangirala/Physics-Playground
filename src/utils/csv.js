// CSV writing (RFC 4180): comma-separated, CRLF line ends, fields quoted only
// when they contain a comma, quote or line break.

const needsQuotes = /[",\r\n]/;

/** Numbers keep full precision: String(x) is the shortest text that reads back as exactly x. */
function csvField(value) {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : String(value);
    return needsQuotes.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const csvRow = (values) => values.map(csvField).join(',');

/**
 * A CSV document. `metadata` rows ([key, value] pairs) come first, each
 * prefixed with "#" so tools such as pandas (comment='#') can skip them; then
 * one header row and the data rows.
 */
export function toCsv({ metadata = [], header, rows }) {
    const lines = [
        ...metadata.map(([key, value]) => csvRow([`# ${key}`, value])),
        ...(metadata.length ? [''] : []),
        csvRow(header),
        ...rows.map(csvRow),
    ];
    return `${lines.join('\r\n')}\r\n`;
}
