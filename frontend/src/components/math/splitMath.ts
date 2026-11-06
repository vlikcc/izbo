export interface MathSegment {
    kind: 'text' | 'inline' | 'display';
    value: string;
}

/**
 * Splits question text into plain text and LaTeX: <c>$...$</c> is inline, <c>$$...$$</c> a display formula,
 * and <c>\$</c> a literal dollar sign. An unclosed <c>$</c> stays as text.
 */
export function splitMath(source: string): MathSegment[] {
    const segments: MathSegment[] = [];
    let text = '';
    let i = 0;

    const flushText = () => {
        if (text) segments.push({ kind: 'text', value: text });
        text = '';
    };

    while (i < source.length) {
        const ch = source[i];
        if (ch === '\\' && source[i + 1] === '$') {
            text += '$';
            i += 2;
            continue;
        }

        if (ch === '$') {
            const display = source[i + 1] === '$';
            const open = display ? 2 : 1;
            const close = findClosing(source, i + open, display);
            if (close > i + open) {
                flushText();
                segments.push({ kind: display ? 'display' : 'inline', value: source.slice(i + open, close) });
                i = close + open;
                continue;
            }
        }

        text += ch;
        i++;
    }

    flushText();
    return segments;
}

function findClosing(source: string, from: number, display: boolean): number {
    for (let j = from; j < source.length; j++) {
        if (source[j] === '\\') {
            j++;
            continue;
        }
        if (source[j] === '$' && (!display || source[j + 1] === '$')) return j;
    }
    return -1;
}
