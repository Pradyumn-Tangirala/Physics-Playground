/** Saves `text` as a file through the browser's download mechanism. */
export function downloadText(filename, text, type = 'text/csv;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next task: some browsers start the download asynchronously.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** "pendulum-rk4-2026-10-09T14-03-12.csv": safe on every file system. */
export const timestampedName = (stem, now = new Date()) =>
    `${stem}-${now.toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
